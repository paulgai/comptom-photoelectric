const crystalGrid = document.querySelector("#crystal-grid");
const atomicNumberSlider = document.querySelector("#atomic-number-slider");
const photonEnergySlider = document.querySelector("#photon-energy-slider");
const photonTrailToggles = {
  pass: document.querySelector("#pass-photon-trails-toggle"),
  scattered: document.querySelector("#scattered-photon-trails-toggle"),
  secondary: document.querySelector("#secondary-photon-trails-toggle"),
};
const atomCountersToggle = document.querySelector("#atom-counters-toggle");
const distanceSlider = document.querySelector("#distance-slider");
const app2PlayButton = document.querySelector("#app2-play-button");
const app2PauseButton = document.querySelector("#app2-pause-button");
const app2StepBackwardButton = document.querySelector("#app2-step-backward");
const app2StepForwardButton = document.querySelector("#app2-step-forward");
const app2RestartButton = document.querySelector("#app2-restart-button");
const app2RadiationButton = document.querySelector("#app2-radiation-button");
const secondAppView = document.querySelector("#second-app-view");
const probabilityOutputs = {
  totalPass: document.querySelector("#total-pass-probability"),
  totalInteraction: document.querySelector("#total-interaction-probability"),
  absoluteCompton: document.querySelector("#absolute-compton-probability"),
  absolutePhotoelectric: document.querySelector("#absolute-photoelectric-probability"),
  comptonShare: document.querySelector("#compton-share-probability"),
  photoelectricShare: document.querySelector("#photoelectric-share-probability"),
};
const probabilityMeters = {
  totalPass: document.querySelector("#total-pass-meter"),
  totalInteraction: document.querySelector("#total-interaction-meter"),
  absoluteCompton: document.querySelector("#absolute-compton-meter"),
  absolutePhotoelectric: document.querySelector("#absolute-photoelectric-meter"),
  comptonShare: document.querySelector("#compton-share-meter"),
  photoelectricShare: document.querySelector("#photoelectric-share-meter"),
};
const gridRows = 5;
const svgNamespace = "http://www.w3.org/2000/svg";
const atomColumnCount = 5;
const fixedPhotonCount = 100;
const photonSpeedPixelsPerSecond = 450;
const photonEmissionDelaySeconds = 0.009;
const photoelectricCrossSectionScale = 64;
const interactionProbabilityScale = Math.LN2 / 40;
const electronRestEnergyKeV = 511;
const photoelectricZPower = 4;
const app2FrameStepSeconds = 5 / 60;
const photoelectricRefillDelaySeconds = app2FrameStepSeconds;
const stepHoldDelayMs = 400;
const stepRepeatIntervalMs = app2FrameStepSeconds * 1000;
const atomSpinDurationSeconds = 8;
let isApp2Playing = false;
let radiationState = null;
let app2AnimationFrame = null;
let app2LastTimestamp = null;
let atomAnimationClockSeconds = 0;
let stepHoldTimeout = null;
let stepRepeatInterval = null;
const comptonScatterMaxProbabilityCache = new Map();

const sliderOutputs = [
  {
    slider: photonEnergySlider,
    output: document.querySelector("#photon-energy-value"),
    format: (value) => `${Number(value).toFixed(0)} keV`,
  },
  {
    slider: atomicNumberSlider,
    output: document.querySelector("#atomic-number-value"),
    format: (value) => Number(value).toFixed(0),
    afterUpdate: () => updateGridAtoms(),
  },
  {
    slider: distanceSlider,
    output: document.querySelector("#distance-value"),
    format: (value) => Number(value).toFixed(0),
    afterUpdate: () => renderCrystalGrid(atomColumnCount),
  },
];

function renderCrystalGrid(columnCount) {
  crystalGrid.style.setProperty("--grid-columns", columnCount);
  crystalGrid.replaceChildren();

  getCenteredColumnOffsets(columnCount).forEach((offset) => {
    const isStaggered = Math.abs(offset) % 2 === 1;
    const column = document.createElement("span");
    column.className = `crystal-column${isStaggered ? " is-staggered" : ""}`;
    column.style.setProperty("--column-offset", offset);
    const rows = isStaggered ? gridRows + 1 : gridRows;

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const cell = document.createElement("span");
      cell.className = "crystal-cell";
      cell.dataset.row = rowIndex;
      cell.append(createCellCounters());
      cell.append(createAtomGlyph(getCurrentAtomicNumber()));
      column.append(cell);
    }

    crystalGrid.append(column);
  });
}

function createCellCounters() {
  const counters = document.createElement("span");
  counters.className = "cell-counters";
  counters.dataset.compton = "0";
  counters.dataset.photoelectric = "0";
  counters.hidden = true;
  counters.textContent = "C: 0\nΦ: 0";
  return counters;
}

function getCenteredColumnOffsets(columnCount) {
  const offsets = [0];

  for (let distance = 1; offsets.length < columnCount; distance += 1) {
    offsets.push(-distance);

    if (offsets.length < columnCount) {
      offsets.push(distance);
    }
  }

  return offsets;
}

function getCurrentAtomicNumber() {
  return Number(atomicNumberSlider.value);
}

function updateGridAtoms() {
  crystalGrid.querySelectorAll(".atom-glyph").forEach((atom) => {
    atom.replaceWith(createAtomGlyph(getCurrentAtomicNumber()));
  });
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(svgNamespace, tagName);

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });

  return element;
}

function createAtomGlyph(atomicNumber) {
  const svg = createSvgElement("svg", {
    class: "atom-glyph",
    viewBox: "0 0 120 120",
    role: "img",
    "aria-label": `Άτομο με ατομικό αριθμό Z ${atomicNumber}`,
  });
  const nucleusRadius = 4;
  const shellRadii = [14, 24, 34, 44, 54];
  const shellCounts = getDisplayShellCounts(atomicNumber);

  shellRadii.forEach((radius, index) => {
    if (shellCounts[index] === 0) {
      return;
    }

    svg.append(createSvgElement("circle", {
      class: "atom-orbit",
      cx: 60,
      cy: 60,
      r: radius,
    }));
  });

  const electronGroup = createSvgElement("g", {
    class: "atom-electron-shell",
  });

  shellCounts.forEach((count, shellIndex) => {
    const radius = shellRadii[shellIndex];

    for (let electronIndex = 0; electronIndex < count; electronIndex += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * electronIndex) / count;
      const x = 60 + Math.cos(angle) * radius;
      const y = 60 + Math.sin(angle) * radius;

      electronGroup.append(createSvgElement("circle", {
        class: "atom-electron",
        "data-shell-index": shellIndex,
        "data-electron-index": electronIndex,
        "data-original-shell-index": shellIndex,
        "data-original-electron-index": electronIndex,
        "data-original-cx": x.toFixed(2),
        "data-original-cy": y.toFixed(2),
        cx: x.toFixed(2),
        cy: y.toFixed(2),
        r: 1.65,
      }));
    }
  });

  svg.append(electronGroup);
  svg.append(createSvgElement("circle", {
    class: "atom-nucleus",
    cx: 60,
    cy: 60,
    r: nucleusRadius.toFixed(2),
  }));
  return svg;
}

function getDisplayShellCounts(atomicNumber) {
  const shellCapacities = [2, 8, 18, 32, 50];
  const shellCounts = shellCapacities.map(() => 0);
  const aufbauOrder = [
    { shell: 1, capacity: 2 },
    { shell: 2, capacity: 2 },
    { shell: 2, capacity: 6 },
    { shell: 3, capacity: 2 },
    { shell: 3, capacity: 6 },
    { shell: 4, capacity: 2 },
    { shell: 3, capacity: 10 },
    { shell: 4, capacity: 6 },
    { shell: 5, capacity: 2 },
    { shell: 4, capacity: 10 },
    { shell: 5, capacity: 6 },
    { shell: 5, capacity: 2 },
    { shell: 4, capacity: 14 },
    { shell: 5, capacity: 10 },
  ];
  let remainingElectrons = atomicNumber;

  for (const orbital of aufbauOrder) {
    if (remainingElectrons <= 0) {
      break;
    }

    const shellIndex = orbital.shell - 1;
    const shellRoom = shellCapacities[shellIndex] - shellCounts[shellIndex];
    const electrons = Math.min(orbital.capacity, shellRoom, remainingElectrons);

    if (electrons <= 0) {
      continue;
    }

    shellCounts[shellIndex] += electrons;
    remainingElectrons -= electrons;
  }

  return shellCounts;
}

function setApp2Playing(nextIsPlaying) {
  isApp2Playing = nextIsPlaying;
  app2PlayButton.disabled = isApp2Playing;
  app2PauseButton.disabled = !isApp2Playing;
  app2PlayButton.classList.toggle("is-active", isApp2Playing);
  document.body.classList.toggle("app2-paused", !isApp2Playing);

  if (isApp2Playing && app2AnimationFrame === null) {
    app2LastTimestamp = null;
    app2AnimationFrame = requestAnimationFrame(animateApp2);
  }

  if (!isApp2Playing && app2AnimationFrame !== null) {
    cancelAnimationFrame(app2AnimationFrame);
    app2AnimationFrame = null;
    app2LastTimestamp = null;
  }

}

function updateAllSliderOutputs() {
  sliderOutputs.forEach(({ slider, output, format, afterUpdate }) => {
    output.textContent = format(slider.value);
    afterUpdate?.(slider.value);
  });
  updateProbabilityPanel();
}

function stepRadiation(seconds) {
  setApp2Playing(false);
  stepAtomRotation(seconds);

  if (!radiationState) {
    return;
  }

  const maxElapsed = getRadiationEndTime();
  radiationState.elapsed = Math.min(maxElapsed, Math.max(0, radiationState.elapsed + seconds));
  renderRadiationFrame(radiationState.elapsed);
}

function restartApp2Controls() {
  setApp2Playing(false);
  resetRadiation();
  resetAtomRotation();
  updateAllSliderOutputs();
}

function startApp2Radiation() {
  resetRadiation();

  const atomCells = getGridAtomCells();

  if (atomCells.length === 0) {
    return;
  }

  const probabilities = calculateInteractionProbabilities();
  const photonFragment = document.createDocumentFragment();
  const atomStates = createAtomInteractionStates(atomCells);
  const photonPlans = Array.from({ length: getCurrentPhotonCount() }, (_, index) => {
    return {
      photonNumber: index + 1,
      delay: index * photonEmissionDelaySeconds,
      result: getPhotonInteractionResult(atomCells, probabilities),
    };
  });
  const photonRecords = new Map();

  [...photonPlans]
    .sort((a, b) => estimatePhotonInteractionTime(a) - estimatePhotonInteractionTime(b))
    .forEach((plan) => {
      photonRecords.set(
        plan.photonNumber,
        createPhotonRecord(plan, photonFragment, atomStates),
      );
    });

  const photons = photonPlans.map((plan) => photonRecords.get(plan.photonNumber));
  secondAppView.append(photonFragment);

  radiationState = {
    photons,
    elapsed: 0,
    endTime: Math.max(...photons.map((photon) => photon.endTime)),
    renderedElapsed: 0,
    nextPhotonIndex: 0,
    activePhotons: new Set(),
  };
  setApp2Playing(true);
}

function resetRadiation() {
  document.querySelectorAll(".beam-photon, .photon-trail, .recoil-electron").forEach((element) => element.remove());
  restoreAllBoundElectrons();
  resetCellCounters();
  radiationState = null;
}

function resetCellCounters() {
  crystalGrid.querySelectorAll(".cell-counters").forEach((counters) => {
    counters.dataset.compton = "0";
    counters.dataset.photoelectric = "0";
    counters.textContent = "C: 0\nΦ: 0";
    syncCellCounterVisibility(counters);
  });
}

function calculateInteractionProbabilities() {
  const energyKeV = Number(photonEnergySlider.value);
  const atomicNumber = Number(atomicNumberSlider.value);
  const comptonCrossSection = atomicNumber;
  const photoelectricCrossSection =
    photoelectricCrossSectionScale * (atomicNumber ** photoelectricZPower) / (energyKeV ** 3);
  const totalCrossSection = comptonCrossSection + photoelectricCrossSection;
  const interactionProbability = 1 - Math.exp(-interactionProbabilityScale * totalCrossSection);
  const comptonProbability = totalCrossSection > 0
    ? comptonCrossSection / totalCrossSection
    : 0;
  const photoelectricProbability = totalCrossSection > 0
    ? photoelectricCrossSection / totalCrossSection
    : 0;
  const comptonEventProbability = interactionProbability * comptonProbability;
  const photoelectricEventProbability = interactionProbability * photoelectricProbability;

  return {
    comptonCrossSection,
    photoelectricCrossSection,
    totalCrossSection,
    comptonEventProbability,
    photoelectricEventProbability,
    comptonProbability,
    photoelectricProbability,
    interactionProbability,
    passProbability: 1 - interactionProbability,
  };
}

function getCurrentPhotonCount() {
  return fixedPhotonCount;
}

function isPassPhotonTrailEnabled() {
  return photonTrailToggles.pass.checked;
}

function isScatteredPhotonTrailEnabled() {
  return photonTrailToggles.scattered.checked;
}

function isSecondaryPhotonTrailEnabled() {
  return photonTrailToggles.secondary.checked;
}

function areAtomCountersEnabled() {
  return atomCountersToggle.checked;
}

function hasCellCounterValues(counters) {
  return Number(counters.dataset.compton) > 0 || Number(counters.dataset.photoelectric) > 0;
}

function syncCellCounterVisibility(counters) {
  counters.hidden = !areAtomCountersEnabled() || !hasCellCounterValues(counters);
}

function syncAllCellCounterVisibility() {
  crystalGrid.querySelectorAll(".cell-counters").forEach(syncCellCounterVisibility);
}

function formatProbability(value) {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(1)}%`;
}

function setProbabilityValue(key, value, displayValue = value) {
  const clampedValue = Math.max(0, Math.min(1, value));

  probabilityOutputs[key].textContent = formatProbability(displayValue);
  probabilityMeters[key].style.setProperty("--probability-value", `${clampedValue * 100}%`);
}

function getDisplayProbabilityValues(values, targetValue = 1) {
  const clampedValues = values.map((value) => Math.max(0, Math.min(1, value)));
  const roundedTenths = clampedValues.map((value) => Math.round(value * 1000));
  const targetTenths = Math.round(Math.max(0, Math.min(1, targetValue)) * 1000);
  const difference = targetTenths - roundedTenths.reduce((sum, value) => sum + value, 0);
  roundedTenths[roundedTenths.length - 1] += difference;

  return roundedTenths.map((value) => value / 1000);
}

function updateProbabilityPanel() {
  const probabilities = calculateInteractionProbabilities();
  const totalInteractionProbability = probabilities.interactionProbability;
  const totalPassProbability = probabilities.passProbability;
  const totalComptonProbability = probabilities.comptonEventProbability;
  const totalPhotoelectricProbability = probabilities.photoelectricEventProbability;
  const passInteractionDisplayValues = getDisplayProbabilityValues([
    totalPassProbability,
    totalInteractionProbability,
  ]);
  const absoluteInteractionDisplayValues = getDisplayProbabilityValues(
    [
      totalComptonProbability,
      totalPhotoelectricProbability,
    ],
    passInteractionDisplayValues[1],
  );
  const interactionTypeDisplayValues = getDisplayProbabilityValues([
    probabilities.comptonProbability,
    probabilities.photoelectricProbability,
  ], totalInteractionProbability > 0 ? 1 : 0);

  setProbabilityValue("totalPass", totalPassProbability, passInteractionDisplayValues[0]);
  setProbabilityValue("totalInteraction", totalInteractionProbability, passInteractionDisplayValues[1]);
  setProbabilityValue("absoluteCompton", totalComptonProbability, absoluteInteractionDisplayValues[0]);
  setProbabilityValue(
    "absolutePhotoelectric",
    totalPhotoelectricProbability,
    absoluteInteractionDisplayValues[1],
  );
  setProbabilityValue("comptonShare", probabilities.comptonProbability, interactionTypeDisplayValues[0]);
  setProbabilityValue("photoelectricShare", probabilities.photoelectricProbability, interactionTypeDisplayValues[1]);
}

function getGridAtomCells() {
  return [...crystalGrid.querySelectorAll(".crystal-column")]
    .map((column) => {
      const columnRect = column.getBoundingClientRect();

      return {
        x: columnRect.left + columnRect.width / 2,
        cells: [...column.querySelectorAll(".crystal-cell")],
      };
    })
    .sort((a, b) => a.x - b.x)
    .flatMap((column) => column.cells);
}

function createAtomInteractionStates(atomCells) {
  const atomStates = new Map();

  atomCells.forEach((cell) => {
    atomStates.set(cell, createAtomInteractionState(cell));
  });

  return atomStates;
}

function createAtomInteractionState(cell) {
  const electrons = [...cell.querySelectorAll(".atom-electron")].map((element) => {
    const shellIndex = Number(element.dataset.shellIndex);
    const electronIndex = Number(element.dataset.electronIndex);

    return {
      element,
      shellIndex,
      electronIndex,
      currentShellIndex: shellIndex,
      currentElectronIndex: electronIndex,
      currentCx: element.dataset.originalCx,
      currentCy: element.dataset.originalCy,
    };
  });

  return {
    cell,
    electrons,
  };
}

function estimatePhotonInteractionTime(plan) {
  if (!plan.result.interacted || !plan.result.cell) {
    return Number.POSITIVE_INFINITY;
  }

  const cellRect = plan.result.cell.getBoundingClientRect();

  return plan.delay + Math.max(0, cellRect.left + cellRect.width / 2 + 80) / photonSpeedPixelsPerSecond;
}

function createPhotonRecord(plan, photonFragment, atomStates) {
  const { photonNumber, delay, result } = plan;
  const startX = -80;
  const target = getPhotonTarget(result, delay, startX, atomStates);
  const photonElement = document.createElement("span");
  const incomingTrailElement = document.createElement("span");
  const scatterTrailElement = document.createElement("span");
  const recoilElectronElement = result.interacted ? document.createElement("span") : null;
  const deexcitationPhotonElement = result.type === "photoelectric" ? document.createElement("span") : null;
  const deexcitationTrailElement = result.type === "photoelectric" ? document.createElement("span") : null;
  const startY = target.y;
  const travelDistance = Math.hypot(target.x - startX, target.y - startY);
  const incomingAngle = Math.atan2(target.y - startY, target.x - startX);
  const incomingDuration = travelDistance / photonSpeedPixelsPerSecond;
  const interactionPlan = result.type === "compton"
    ? createComptonScatterPlan(target.x, target.y)
    : result.type === "photoelectric"
      ? createPhotoelectricElectronPlan(target.x, target.y)
      : null;
  const scatterPlan = result.type === "compton"
    ? interactionPlan
    : null;
  const scatterDuration = scatterPlan
    ? scatterPlan.distance / photonSpeedPixelsPerSecond
    : 0;
  const photonDuration = incomingDuration + scatterDuration;
  const recoilDuration = interactionPlan?.electronDuration ?? 0;
  const refillTime = result.type === "photoelectric"
    ? delay + incomingDuration + photoelectricRefillDelaySeconds
    : null;
  const deexcitationPlan = result.type === "photoelectric"
    ? createDeexcitationPhotonPlan(target.x, target.y, refillTime)
    : null;
  const deexcitationEndOffset = deexcitationPlan
    ? deexcitationPlan.startTime + deexcitationPlan.duration - delay
    : 0;
  const duration = Math.max(photonDuration, incomingDuration + recoilDuration, deexcitationEndOffset);

  incomingTrailElement.className = "photon-trail is-blue";
  incomingTrailElement.style.opacity = "0";
  incomingTrailElement.style.transform = `translate3d(${startX}px, ${startY}px, 0) rotate(${incomingAngle}rad)`;
  photonFragment.append(incomingTrailElement);

  scatterTrailElement.className = "photon-trail is-blue";
  scatterTrailElement.style.opacity = "0";
  photonFragment.append(scatterTrailElement);

  if (recoilElectronElement) {
    recoilElectronElement.className = "recoil-electron";
    recoilElectronElement.style.opacity = "0";
    recoilElectronElement.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    photonFragment.append(recoilElectronElement);
  }

  if (deexcitationPhotonElement) {
    deexcitationTrailElement.className = "photon-trail is-red";
    deexcitationTrailElement.style.opacity = "0";
    deexcitationTrailElement.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) rotate(${deexcitationPlan.angle}rad)`;
    photonFragment.append(deexcitationTrailElement);

    deexcitationPhotonElement.className = "beam-photon is-deexcitation";
    deexcitationPhotonElement.style.opacity = "0";
    deexcitationPhotonElement.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) rotate(${deexcitationPlan.angle}rad)`;
    photonFragment.append(deexcitationPhotonElement);
  }

  photonElement.className = `beam-photon${result.interacted ? ` is-${result.type}` : " is-pass"}`;
  photonElement.style.opacity = "0";
  photonElement.style.transform = `translate3d(${startX}px, ${startY}px, 0) rotate(${incomingAngle}rad)`;
  photonFragment.append(photonElement);

  return {
    photonNumber,
    interacted: result.interacted,
    cell: result.cell,
    counterElement: result.cell?.querySelector(".cell-counters") ?? null,
    type: result.type,
    boundElectronElement: target.boundElectronElement ?? null,
    refillElectronElement: target.refillElectronElement ?? null,
    refillShellIndex: target.refillShellIndex ?? null,
    refillElectronIndex: target.refillElectronIndex ?? null,
    refillCx: target.refillCx ?? null,
    refillCy: target.refillCy ?? null,
    refillTime,
    deexcitationPlan,
    boundElectronHidden: false,
    refillApplied: false,
    startX,
    startY,
    endX: target.x,
    endY: target.y,
    scatterEndX: scatterPlan?.x ?? null,
    scatterEndY: scatterPlan?.y ?? null,
    recoilEndX: interactionPlan?.electronX ?? null,
    recoilEndY: interactionPlan?.electronY ?? null,
    incomingAngle,
    scatterAngle: scatterPlan?.angle ?? null,
    recoilAngle: interactionPlan?.electronAngle ?? null,
    delay,
    incomingDuration,
    scatterDuration,
    photonDuration,
    recoilDuration,
    duration,
    interactionTime: delay + incomingDuration,
    endTime: delay + duration,
    element: photonElement,
    incomingTrailElement,
    scatterTrailElement,
    recoilElectronElement,
    deexcitationPhotonElement,
    deexcitationTrailElement,
    visibleTrailOpacity: "0",
    visibleScatterTrailOpacity: "0",
    visibleDeexcitationTrailOpacity: "0",
    visibleRecoilOpacity: "0",
    visibleDeexcitationOpacity: "0",
    visibleTrailWidth: "",
    visibleScatterTrailWidth: "",
    visibleDeexcitationTrailWidth: "",
    visibleOpacity: "0",
    counterApplied: false,
    completed: false,
  };
}

function getPhotonInteractionResult(atomCells, probabilities) {
  const randomValue = Math.random();

  if (randomValue < probabilities.comptonEventProbability) {
    const cell = atomCells[Math.floor(Math.random() * atomCells.length)];

    return {
      interacted: true,
      cell,
      type: "compton",
    };
  }

  if (randomValue < probabilities.comptonEventProbability + probabilities.photoelectricEventProbability) {
    const cell = atomCells[Math.floor(Math.random() * atomCells.length)];

    return {
      interacted: true,
      cell,
      type: "photoelectric",
    };
  }

  return {
    interacted: false,
    cell: null,
    type: "pass",
  };
}

function getPhotonTarget(result, delay, startX, atomStates) {
  if (!result.interacted) {
    const gridRect = crystalGrid.getBoundingClientRect();

    return {
      x: window.innerWidth + 90,
      y: gridRect.top + Math.random() * gridRect.height,
    };
  }

  const cellRect = result.cell.getBoundingClientRect();
  const atomState = atomStates.get(result.cell);

  if (result.type === "compton") {
    const comptonTarget = getOuterElectronCollisionTarget(atomState, cellRect, delay, startX);

    if (comptonTarget) {
      return comptonTarget;
    }
  }

  if (result.type === "photoelectric") {
    const photoelectricTarget = getKShellPhotoelectricTarget(atomState, cellRect, delay, startX);

    if (photoelectricTarget) {
      return photoelectricTarget;
    }
  }

  const atomRadius = Math.min(cellRect.width, cellRect.height) * 0.34;
  const targetRadius = atomRadius * 0.26;
  const angle = Math.random() * Math.PI * 2;

  return {
    x: cellRect.left + cellRect.width / 2 + Math.cos(angle) * targetRadius,
    y: cellRect.top + cellRect.height / 2 + Math.sin(angle) * targetRadius,
  };
}

function getKShellPhotoelectricTarget(atomState, cellRect, delay, startX) {
  const kElectron = chooseAvailableKElectron(atomState);

  if (!kElectron) {
    return null;
  }

  const donorElectron = chooseAvailableOuterElectron(atomState);
  const target = getElectronCollisionTarget(cellRect, kElectron, delay, startX);
  const vacancyCx = kElectron.currentCx;
  const vacancyCy = kElectron.currentCy;

  return {
    ...target,
    boundElectronElement: kElectron.element,
    refillElectronElement: donorElectron?.element ?? null,
    refillShellIndex: donorElectron ? 0 : null,
    refillElectronIndex: donorElectron ? kElectron.currentElectronIndex : null,
    refillCx: vacancyCx,
    refillCy: vacancyCy,
  };
}

function getOuterElectronCollisionTarget(atomState, cellRect, delay, startX) {
  const electron = chooseAvailableOuterElectron(atomState);

  if (!electron) {
    return null;
  }

  const target = getElectronCollisionTarget(cellRect, electron, delay, startX);

  return {
    ...target,
    boundElectronElement: electron.element,
  };
}

function chooseAvailableKElectron(atomState) {
  return atomState.electrons.find((electron) => {
    return electron.currentShellIndex === 0;
  }) ?? null;
}

function chooseAvailableOuterElectron(atomState) {
  const outerElectrons = atomState.electrons.filter((electron) => {
    return electron.currentShellIndex > 0;
  });

  if (outerElectrons.length === 0) {
    return null;
  }

  const outerShellIndex = Math.max(...outerElectrons.map((electron) => electron.currentShellIndex));
  const candidates = outerElectrons.filter((electron) => electron.currentShellIndex === outerShellIndex);

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function getElectronCollisionTarget(cellRect, electron, delay, startX) {
  const shellRadii = [14, 24, 34, 44, 54];
  const shellCounts = getDisplayShellCounts(getCurrentAtomicNumber());
  const electronCount = Math.max(1, shellCounts[electron.currentShellIndex]);
  const baseAngle = -Math.PI / 2 + (Math.PI * 2 * electron.currentElectronIndex) / electronCount;
  let collisionOffsetSeconds = 0;
  let target = getElectronTargetAtTime(cellRect, shellRadii[electron.currentShellIndex], baseAngle, delay);

  for (let iteration = 0; iteration < 6; iteration += 1) {
    collisionOffsetSeconds = Math.max(0, (target.x - startX) / photonSpeedPixelsPerSecond);
    target = getElectronTargetAtTime(
      cellRect,
      shellRadii[electron.currentShellIndex],
      baseAngle,
      delay + collisionOffsetSeconds,
    );
  }

  return {
    ...target,
    electron,
    collisionOffsetSeconds,
  };
}

function getElectronTargetAtTime(cellRect, shellRadius, baseAngle, futureSeconds) {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const atomSvgSize = Math.min(cellRect.width * 0.92, rootFontSize * 8.4);
  const pixelsPerSvgUnit = atomSvgSize / 120;
  const rotationAngle =
    -Math.PI * 2 * ((atomAnimationClockSeconds + futureSeconds) / atomSpinDurationSeconds);
  const angle = baseAngle + rotationAngle;

  return {
    x: cellRect.left + cellRect.width / 2 + Math.cos(angle) * shellRadius * pixelsPerSvgUnit,
    y: cellRect.top + cellRect.height / 2 + Math.sin(angle) * shellRadius * pixelsPerSvgUnit,
  };
}

function createComptonScatterPlan(x, y) {
  const energyKeV = Number(photonEnergySlider.value);
  const theta = sampleComptonScatterAngle(energyKeV);
  const scatterSign = Math.random() < 0.5 ? -1 : 1;
  const angle = theta * scatterSign;
  const scatteredEnergyKeV =
    energyKeV / (1 + (energyKeV / electronRestEnergyKeV) * (1 - Math.cos(theta)));
  const electronAngleMagnitude = Math.atan2(
    scatteredEnergyKeV * Math.sin(theta),
    energyKeV - scatteredEnergyKeV * Math.cos(theta),
  );
  const electronAngle = -scatterSign * electronAngleMagnitude;
  const electronKineticEnergyKeV = Math.max(0, energyKeV - scatteredEnergyKeV);
  const gamma = 1 + electronKineticEnergyKeV / electronRestEnergyKeV;
  const beta = Math.sqrt(Math.max(0, 1 - 1 / (gamma * gamma)));
  const exitPoint = getViewportExitPoint(x, y, angle);
  const electronExitPoint = getViewportExitPoint(x, y, electronAngle);
  const electronDistance = Math.hypot(electronExitPoint.x - x, electronExitPoint.y - y);
  const electronSpeed = photonSpeedPixelsPerSecond * Math.max(0.22, Math.min(0.65, beta * 1.6));

  return {
    ...exitPoint,
    angle,
    electronX: electronExitPoint.x,
    electronY: electronExitPoint.y,
    electronAngle,
    electronDuration: electronDistance / electronSpeed,
    distance: Math.hypot(exitPoint.x - x, exitPoint.y - y),
  };
}

function createPhotoelectricElectronPlan(x, y) {
  const angle = randomRange(-Math.PI * 0.45, Math.PI * 0.45);
  const electronExitPoint = getViewportExitPoint(x, y, angle);
  const electronDistance = Math.hypot(electronExitPoint.x - x, electronExitPoint.y - y);
  const electronSpeed = photonSpeedPixelsPerSecond * 0.38;

  return {
    electronX: electronExitPoint.x,
    electronY: electronExitPoint.y,
    electronAngle: angle,
    electronDuration: electronDistance / electronSpeed,
  };
}

function createDeexcitationPhotonPlan(x, y, startTime) {
  const angle = Math.random() * Math.PI * 2;
  const exitPoint = getViewportExitPoint(x, y, angle);
  const distance = Math.hypot(exitPoint.x - x, exitPoint.y - y);

  return {
    startTime,
    startX: x,
    startY: y,
    endX: exitPoint.x,
    endY: exitPoint.y,
    angle,
    duration: distance / photonSpeedPixelsPerSecond,
  };
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function sampleComptonScatterAngle(energyKeV) {
  const maxProbability = getComptonScatterMaxProbability(energyKeV);

  for (let attempts = 0; attempts < 80; attempts += 1) {
    const theta = Math.random() * Math.PI;
    const probability = getComptonScatterProbability(theta, energyKeV);

    if (Math.random() * maxProbability <= probability) {
      return theta;
    }
  }

  return Math.PI / 3;
}

function getComptonScatterMaxProbability(energyKeV) {
  const cacheKey = energyKeV.toFixed(0);

  if (comptonScatterMaxProbabilityCache.has(cacheKey)) {
    return comptonScatterMaxProbabilityCache.get(cacheKey);
  }

  let maxProbability = 0;

  for (let degree = 1; degree < 180; degree += 3) {
    maxProbability = Math.max(
      maxProbability,
      getComptonScatterProbability((degree * Math.PI) / 180, energyKeV),
    );
  }

  comptonScatterMaxProbabilityCache.set(cacheKey, maxProbability);
  return maxProbability;
}

function getComptonScatterProbability(theta, energyKeV) {
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const ratio = 1 / (1 + (energyKeV / electronRestEnergyKeV) * (1 - cosTheta));

  return ratio * ratio * (1 / ratio + ratio - sinTheta * sinTheta) * Math.max(0, sinTheta);
}

function getViewportExitPoint(x, y, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const candidates = [];

  if (dx > 0) {
    candidates.push((window.innerWidth + 90 - x) / dx);
  } else if (dx < 0) {
    candidates.push((-90 - x) / dx);
  }

  if (dy > 0) {
    candidates.push((window.innerHeight + 90 - y) / dy);
  } else if (dy < 0) {
    candidates.push((-90 - y) / dy);
  }

  const distance = Math.min(...candidates.filter((value) => value > 0));

  return {
    x: x + dx * distance,
    y: y + dy * distance,
  };
}

function animateApp2(timestamp) {
  if (!isApp2Playing) {
    app2AnimationFrame = null;
    return;
  }

  if (app2LastTimestamp === null) {
    app2LastTimestamp = timestamp;
  }

  const deltaSeconds = (timestamp - app2LastTimestamp) / 1000;
  app2LastTimestamp = timestamp;
  atomAnimationClockSeconds += deltaSeconds;
  syncAtomRotation();

  if (radiationState) {
    radiationState.elapsed += deltaSeconds;
    renderRadiationFrame(radiationState.elapsed);

    if (radiationState.elapsed >= getRadiationEndTime()) {
      setApp2Playing(false);
      return;
    }
  }

  app2AnimationFrame = requestAnimationFrame(animateApp2);
}

function stepAtomRotation(seconds) {
  atomAnimationClockSeconds = Math.max(0, atomAnimationClockSeconds + seconds);
  syncAtomRotation();
}

function resetAtomRotation() {
  atomAnimationClockSeconds = 0;
  syncAtomRotation();
}

function syncAtomRotation() {
  const rotation = -360 * (atomAnimationClockSeconds / atomSpinDurationSeconds);

  crystalGrid.style.setProperty("--atom-spin-angle", `${rotation}deg`);
}

function getRadiationEndTime() {
  if (!radiationState) {
    return 0;
  }

  return radiationState.endTime;
}

function renderRadiationFrame(elapsed, forceFullRender = false) {
  if (!radiationState) {
    return;
  }

  const previousElapsed = radiationState.renderedElapsed;
  const isRewind = elapsed < previousElapsed;

  if (isRewind || forceFullRender) {
    rebuildRadiationFrame(elapsed);
    return;
  }

  while (
    radiationState.nextPhotonIndex < radiationState.photons.length &&
    radiationState.photons[radiationState.nextPhotonIndex].delay <= elapsed
  ) {
    const photon = radiationState.photons[radiationState.nextPhotonIndex];

    radiationState.activePhotons.add(photon);
    radiationState.nextPhotonIndex += 1;
  }

  radiationState.activePhotons.forEach((photon) => {
    renderPhotonAtTime(photon, elapsed);

    if (elapsed >= photon.endTime) {
      radiationState.activePhotons.delete(photon);
    }
  });

  radiationState.renderedElapsed = elapsed;
}

function rebuildRadiationFrame(elapsed) {
  resetCellCounters();
  restoreAllBoundElectrons();
  radiationState.activePhotons.clear();
  radiationState.nextPhotonIndex = 0;

  radiationState.photons.forEach((photon, index) => {
    photon.counterApplied = false;
    photon.completed = false;
    photon.boundElectronHidden = false;
    photon.refillApplied = false;

    if (elapsed < photon.delay) {
      setPhotonOpacity(photon, "0");
      setPhotonTrailOpacity(photon, "incoming", "0");
      setPhotonTrailOpacity(photon, "scatter", "0");
      setPhotonTrailOpacity(photon, "deexcitation", "0");
      setRecoilElectronOpacity(photon, "0");
      setDeexcitationPhotonOpacity(photon, "0");
      return;
    }

    renderPhotonAtTime(photon, elapsed);

    if (elapsed < photon.endTime) {
      radiationState.activePhotons.add(photon);
    }

    radiationState.nextPhotonIndex = index + 1;
  });

  radiationState.renderedElapsed = elapsed;
}

function renderPhotonAtTime(photon, elapsed) {
  if (elapsed < photon.delay) {
    setPhotonOpacity(photon, "0");
    setPhotonTrailOpacity(photon, "incoming", "0");
    setPhotonTrailOpacity(photon, "scatter", "0");
    setPhotonTrailOpacity(photon, "deexcitation", "0");
    setRecoilElectronOpacity(photon, "0");
    setDeexcitationPhotonOpacity(photon, "0");
    return;
  }

  const localElapsed = elapsed - photon.delay;
  const incomingProgress = Math.min(1, localElapsed / photon.incomingDuration);
  let x = photon.startX + (photon.endX - photon.startX) * incomingProgress;
  let y = photon.startY + (photon.endY - photon.startY) * incomingProgress;

  if (photon.type === "compton" && localElapsed > photon.incomingDuration) {
    const scatterProgress = Math.min(
      1,
      (localElapsed - photon.incomingDuration) / photon.scatterDuration,
    );

    x = photon.endX + (photon.scatterEndX - photon.endX) * scatterProgress;
    y = photon.endY + (photon.scatterEndY - photon.endY) * scatterProgress;
  }

  const photonAngle = photon.type === "compton" && localElapsed > photon.incomingDuration
    ? photon.scatterAngle
    : photon.incomingAngle;

  photon.element.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${photonAngle}rad)`;
  setPhotonOpacity(photon, getPhotonOpacity(photon, localElapsed));
  renderPhotonTrails(photon, x, y, localElapsed);
  renderRecoilElectron(photon, localElapsed);
  renderDeexcitationPhoton(photon, elapsed);

  if (photon.interacted && !photon.counterApplied && elapsed >= photon.interactionTime) {
    incrementCellCounter(photon);
    hideBoundElectron(photon);
    photon.counterApplied = true;
  }

  if (photon.type === "photoelectric" && !photon.refillApplied && elapsed >= photon.refillTime) {
    refillKShellVacancy(photon);
  }

  if (localElapsed < photon.duration) {
    return;
  }

  setPhotonOpacity(photon, "0");

  photon.completed = true;
}

function getPhotonOpacity(photon, localElapsed) {
  if (photon.type === "photoelectric") {
    const progress = Math.min(1, localElapsed / photon.photonDuration);

    return progress >= 0.96 ? String(1 - (progress - 0.96) / 0.04) : "1";
  }

  if (localElapsed >= photon.photonDuration) {
    return "0";
  }

  return "1";
}

function setPhotonOpacity(photon, opacity) {
  if (photon.visibleOpacity === opacity) {
    return;
  }

  photon.visibleOpacity = opacity;
  photon.element.style.opacity = opacity;
}

function renderRecoilElectron(photon, localElapsed) {
  if (!photon.recoilElectronElement) {
    return;
  }

  if (localElapsed < photon.incomingDuration || localElapsed >= photon.incomingDuration + photon.recoilDuration) {
    setRecoilElectronOpacity(photon, "0");
    return;
  }

  const recoilProgress = Math.min(1, (localElapsed - photon.incomingDuration) / photon.recoilDuration);
  const x = photon.endX + (photon.recoilEndX - photon.endX) * recoilProgress;
  const y = photon.endY + (photon.recoilEndY - photon.endY) * recoilProgress;

  photon.recoilElectronElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  setRecoilElectronOpacity(photon, "1");
}

function setRecoilElectronOpacity(photon, opacity) {
  if (!photon.recoilElectronElement || photon.visibleRecoilOpacity === opacity) {
    return;
  }

  photon.visibleRecoilOpacity = opacity;
  photon.recoilElectronElement.style.opacity = opacity;
}

function renderDeexcitationPhoton(photon, elapsed) {
  if (!photon.deexcitationPhotonElement || !photon.deexcitationPlan) {
    return;
  }

  const { deexcitationPlan } = photon;

  if (elapsed < deexcitationPlan.startTime) {
    setDeexcitationPhotonOpacity(photon, "0");
    setPhotonTrailOpacity(photon, "deexcitation", "0");
    return;
  }

  if (elapsed >= deexcitationPlan.startTime + deexcitationPlan.duration) {
    setDeexcitationPhotonOpacity(photon, "0");
    renderDeexcitationPhotonTrail(photon, deexcitationPlan.endX, deexcitationPlan.endY);
    return;
  }

  const progress = Math.min(1, (elapsed - deexcitationPlan.startTime) / deexcitationPlan.duration);
  const x = deexcitationPlan.startX + (deexcitationPlan.endX - deexcitationPlan.startX) * progress;
  const y = deexcitationPlan.startY + (deexcitationPlan.endY - deexcitationPlan.startY) * progress;

  photon.deexcitationPhotonElement.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${deexcitationPlan.angle}rad)`;
  setDeexcitationPhotonOpacity(photon, "1");
  renderDeexcitationPhotonTrail(photon, x, y);
}

function setDeexcitationPhotonOpacity(photon, opacity) {
  if (!photon.deexcitationPhotonElement || photon.visibleDeexcitationOpacity === opacity) {
    return;
  }

  photon.visibleDeexcitationOpacity = opacity;
  photon.deexcitationPhotonElement.style.opacity = opacity;
}

function hideBoundElectron(photon) {
  if (!photon.boundElectronElement || photon.boundElectronHidden) {
    return;
  }

  photon.boundElectronElement.style.visibility = "hidden";
  photon.boundElectronHidden = true;
}

function refillKShellVacancy(photon) {
  if (!photon.refillElectronElement || photon.refillApplied) {
    return;
  }

  photon.refillElectronElement.setAttribute("cx", photon.refillCx);
  photon.refillElectronElement.setAttribute("cy", photon.refillCy);
  photon.refillElectronElement.dataset.shellIndex = String(photon.refillShellIndex);
  photon.refillElectronElement.dataset.electronIndex = String(photon.refillElectronIndex);
  photon.refillApplied = true;
}

function restoreAllBoundElectrons() {
  crystalGrid.querySelectorAll(".atom-electron").forEach((electron) => {
    electron.style.visibility = "";
    electron.setAttribute("cx", electron.dataset.originalCx);
    electron.setAttribute("cy", electron.dataset.originalCy);
    electron.dataset.shellIndex = electron.dataset.originalShellIndex;
    electron.dataset.electronIndex = electron.dataset.originalElectronIndex;
  });
}

function renderPhotonTrails(photon, x, y, localElapsed) {
  const shouldShowIncomingTrail =
    (!photon.interacted && isPassPhotonTrailEnabled()) ||
    (photon.type === "compton" && isScatteredPhotonTrailEnabled()) ||
    (photon.type === "photoelectric" && isSecondaryPhotonTrailEnabled());

  if (!shouldShowIncomingTrail) {
    setPhotonTrailOpacity(photon, "incoming", "0");
  } else {
    const incomingWidth = `${Math.min(
      Math.hypot(photon.endX - photon.startX, photon.endY - photon.startY),
      Math.max(0, localElapsed * photonSpeedPixelsPerSecond),
    ).toFixed(1)}px`;

    if (photon.visibleTrailWidth !== incomingWidth) {
      photon.visibleTrailWidth = incomingWidth;
      photon.incomingTrailElement.style.width = incomingWidth;
    }

    photon.incomingTrailElement.style.transform = `translate3d(${photon.startX}px, ${photon.startY}px, 0) rotate(${photon.incomingAngle}rad)`;
    setPhotonTrailOpacity(photon, "incoming", Number.parseFloat(incomingWidth) > 1 ? "1" : "0");
  }

  if (
    photon.type !== "compton" ||
    localElapsed <= photon.incomingDuration ||
    !isScatteredPhotonTrailEnabled()
  ) {
    setPhotonTrailOpacity(photon, "scatter", "0");
    return;
  }

  const scatterWidth = `${Math.hypot(x - photon.endX, y - photon.endY).toFixed(1)}px`;

  if (photon.visibleScatterTrailWidth !== scatterWidth) {
    photon.visibleScatterTrailWidth = scatterWidth;
    photon.scatterTrailElement.style.width = scatterWidth;
  }

  photon.scatterTrailElement.style.transform = `translate3d(${photon.endX}px, ${photon.endY}px, 0) rotate(${photon.scatterAngle}rad)`;
  setPhotonTrailOpacity(photon, "scatter", Number.parseFloat(scatterWidth) > 1 ? "1" : "0");
}

function renderDeexcitationPhotonTrail(photon, x, y) {
  if (!isSecondaryPhotonTrailEnabled() || !photon.deexcitationTrailElement || !photon.deexcitationPlan) {
    setPhotonTrailOpacity(photon, "deexcitation", "0");
    return;
  }

  const { deexcitationPlan } = photon;
  const deexcitationWidth = `${Math.hypot(x - deexcitationPlan.startX, y - deexcitationPlan.startY).toFixed(1)}px`;

  if (photon.visibleDeexcitationTrailWidth !== deexcitationWidth) {
    photon.visibleDeexcitationTrailWidth = deexcitationWidth;
    photon.deexcitationTrailElement.style.width = deexcitationWidth;
  }

  photon.deexcitationTrailElement.style.transform = `translate3d(${deexcitationPlan.startX}px, ${deexcitationPlan.startY}px, 0) rotate(${deexcitationPlan.angle}rad)`;
  setPhotonTrailOpacity(photon, "deexcitation", Number.parseFloat(deexcitationWidth) > 1 ? "1" : "0");
}

function syncPhotonTrails() {
  if (!radiationState) {
    return;
  }

  renderRadiationFrame(radiationState.elapsed, true);
}

function setPhotonTrailOpacity(photon, segment, opacity) {
  const trailSegments = {
    incoming: ["visibleTrailOpacity", photon.incomingTrailElement],
    scatter: ["visibleScatterTrailOpacity", photon.scatterTrailElement],
    deexcitation: ["visibleDeexcitationTrailOpacity", photon.deexcitationTrailElement],
  };
  const [opacityKey, element] = trailSegments[segment] ?? [];

  if (!element) {
    return;
  }

  if (photon[opacityKey] === opacity) {
    return;
  }

  photon[opacityKey] = opacity;
  element.style.opacity = opacity;
}

function incrementCellCounter(photon) {
  const counters = photon.counterElement;
  const type = photon.type;

  if (!counters) {
    return;
  }

  const key = type === "compton" ? "compton" : "photoelectric";
  const nextValue = Number(counters.dataset[key]) + 1;

  counters.dataset[key] = String(nextValue);
  counters.textContent = `C: ${counters.dataset.compton}\nΦ: ${counters.dataset.photoelectric}`;
  syncCellCounterVisibility(counters);
}

sliderOutputs.forEach(({ slider, output, format, afterUpdate }) => {
  const updateOutput = () => {
    resetRadiation();
    output.textContent = format(slider.value);
    afterUpdate?.(slider.value);
    updateProbabilityPanel();
    setApp2Playing(false);
  };

  slider.addEventListener("input", updateOutput);
  updateOutput();
});

function bindStepHold(button, seconds) {
  const stopStepping = () => {
    if (stepHoldTimeout !== null) {
      clearTimeout(stepHoldTimeout);
      stepHoldTimeout = null;
    }

    if (stepRepeatInterval !== null) {
      clearInterval(stepRepeatInterval);
      stepRepeatInterval = null;
    }
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    stopStepping();
    stepRadiation(seconds);

    stepHoldTimeout = setTimeout(() => {
      stepRadiation(seconds);
      stepRepeatInterval = setInterval(() => {
        stepRadiation(seconds);
      }, stepRepeatIntervalMs);
    }, stepHoldDelayMs);
  });

  button.addEventListener("pointerup", stopStepping);
  button.addEventListener("pointercancel", stopStepping);
  button.addEventListener("lostpointercapture", stopStepping);
  button.addEventListener("mouseleave", stopStepping);
}

app2PlayButton.addEventListener("click", () => setApp2Playing(true));
app2PauseButton.addEventListener("click", () => setApp2Playing(false));
bindStepHold(app2StepBackwardButton, -app2FrameStepSeconds);
bindStepHold(app2StepForwardButton, app2FrameStepSeconds);
app2RestartButton.addEventListener("click", restartApp2Controls);
app2RadiationButton.addEventListener("click", startApp2Radiation);
Object.values(photonTrailToggles).forEach((toggle) => {
  toggle.addEventListener("change", syncPhotonTrails);
});
atomCountersToggle.addEventListener("change", syncAllCellCounterVisibility);
window.addEventListener("blur", () => {
  if (stepHoldTimeout !== null) {
    clearTimeout(stepHoldTimeout);
    stepHoldTimeout = null;
  }

  if (stepRepeatInterval !== null) {
    clearInterval(stepRepeatInterval);
    stepRepeatInterval = null;
  }
});
setApp2Playing(false);
