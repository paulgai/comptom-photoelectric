const atomCanvas = document.querySelector("#atom-canvas");
const atomContext = atomCanvas.getContext("2d");
const playButton = document.querySelector("#play-button");
const pauseButton = document.querySelector("#pause-button");
const stepBackwardButton = document.querySelector("#step-backward");
const stepForwardButton = document.querySelector("#step-forward");
const restartButton = document.querySelector("#restart-button");
const radiationButton = document.querySelector("#radiation-button");
const geometryToggle = document.querySelector("#geometry-toggle");
const phenomenonRadios = document.querySelectorAll('input[name="phenomenon"]');
const panelTitle = document.querySelector(".compton-panel h2");
const panelNote = document.querySelector(".compton-panel p");
const initialWavelengthValue = document.querySelector("#initial-wavelength-value");
const scatterAngleValue = document.querySelector("#scatter-angle-value");
const wavelengthShiftValue = document.querySelector("#wavelength-shift-value");
const scatteredWavelengthValue = document.querySelector("#scattered-wavelength-value");
const scatteredEnergyValue = document.querySelector("#scattered-energy-value");
const electronEnergyValue = document.querySelector("#electron-energy-value");
const electronAngleValue = document.querySelector("#electron-angle-value");
const panelLabels = {
  initialWavelength: initialWavelengthValue.closest("div").querySelector("dt"),
  scatterAngle: scatterAngleValue.closest("div").querySelector("dt"),
  wavelengthShift: wavelengthShiftValue.closest("div").querySelector("dt"),
  scatteredWavelength: scatteredWavelengthValue.closest("div").querySelector("dt"),
  scatteredEnergy: scatteredEnergyValue.closest("div").querySelector("dt"),
  electronEnergy: electronEnergyValue.closest("div").querySelector("dt"),
  electronAngle: electronAngleValue.closest("div").querySelector("dt"),
};

const innerElectronAngles = [20, 200];
const outerElectronAngles = [0, 45, 90, 135, 180, 225, 270, 315];
const frameStepSeconds = 5 / 60;
const photonInitialEnergyKeV = 100;
const electronRestEnergyKeV = 511;
const electronBindingEnergyKeV = 0.05;
const kShellBindingEnergyKeV = 0.87;
const lShellBindingEnergyKeV = 0.05;
const hcKeVNm = 1.239841984;
const electronComptonWavelengthNm = 0.00242631;
const initialWavelengthNm = hcKeVNm / photonInitialEnergyKeV;
const visualInitialWavelengthPx = 10;
const visualEmittedWavelengthPx = 38;
const photonCenterTravelDuration = 1.55;
const photoelectricVacancyDelay = 1;
const photoelectricTransitionDuration = 0.55;
const stepHoldDelayMs = 400;
const stepRepeatIntervalMs = frameStepSeconds * 1000;
const innerElectronBeta = 0.18;
const outerElectronBeta = 0.1;
let elapsedTime = 0;
let lastAnimationTimestamp = null;
let isPlaying = true;
let comptonState = null;
let photoelectricState = null;
let stepHoldTimeout = null;
let stepRepeatInterval = null;
const nucleons = [
  ["proton", -0.34, -0.38, -0.58],
  ["neutron", 0.02, -0.42, -0.55],
  ["proton", 0.35, -0.31, -0.52],
  ["neutron", -0.48, -0.06, -0.44],
  ["proton", 0.48, -0.03, -0.42],
  ["neutron", -0.36, 0.28, -0.4],
  ["proton", 0.34, 0.3, -0.38],
  ["neutron", -0.06, 0.46, -0.45],
  ["proton", -0.18, -0.24, -0.08],
  ["neutron", 0.2, -0.22, -0.06],
  ["proton", -0.32, 0.02, -0.04],
  ["neutron", 0.34, 0.02, -0.02],
  ["proton", -0.12, 0.26, -0.02],
  ["neutron", 0.18, 0.24, 0.0],
  ["proton", 0.0, 0.0, 0.12],
  ["neutron", -0.18, -0.06, 0.34],
  ["proton", 0.18, -0.06, 0.38],
  ["neutron", -0.08, 0.16, 0.5],
  ["proton", 0.1, 0.12, 0.58],
  ["neutron", 0.0, -0.02, 0.76],
];

window.addEventListener("resize", resizeAtomCanvas);
playButton.addEventListener("click", () => setAtomPlaying(true));
pauseButton.addEventListener("click", () => setAtomPlaying(false));
bindStepHold(stepBackwardButton, -frameStepSeconds);
bindStepHold(stepForwardButton, frameStepSeconds);
restartButton.addEventListener("click", restartSimulation);
radiationButton.addEventListener("click", startIrradiation);
geometryToggle.addEventListener("change", drawCurrentAtomFrame);
phenomenonRadios.forEach((radio) => radio.addEventListener("change", handlePhenomenonChange));
initialWavelengthValue.textContent = `${initialWavelengthNm.toFixed(4)} nm`;
window.addEventListener("blur", stopStepHold);

function resizeAtomCanvas() {
  const metrics = getCanvasMetrics();
  const pixelRatio = window.devicePixelRatio || 1;

  if (metrics.width === 0 || metrics.height === 0) {
    return;
  }

  atomCanvas.width = Math.round(metrics.width * pixelRatio);
  atomCanvas.height = Math.round(metrics.height * pixelRatio);
  atomContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawNeonAtom(metrics, elapsedTime);
}

function animateAtom(timestamp) {
  if (lastAnimationTimestamp === null) {
    lastAnimationTimestamp = timestamp;
  }

  if (isPlaying) {
    elapsedTime += (timestamp - lastAnimationTimestamp) / 1000;
  }

  lastAnimationTimestamp = timestamp;
  const metrics = getCanvasMetrics();

  if (metrics.width > 0 && metrics.height > 0) {
    drawNeonAtom(metrics, elapsedTime);
  }

  requestAnimationFrame(animateAtom);
}

function setAtomPlaying(nextIsPlaying) {
  isPlaying = nextIsPlaying;
  playButton.disabled = isPlaying;
  pauseButton.disabled = !isPlaying;
  playButton.classList.toggle("is-active", isPlaying);

  if (isPlaying) {
    lastAnimationTimestamp = null;
  }
}

function playAtom() {
  setAtomPlaying(true);
  lastAnimationTimestamp = null;
}

function pauseAtom() {
  setAtomPlaying(false);
}

function stepAtom(seconds) {
  setAtomPlaying(false);
  elapsedTime = Math.max(0, elapsedTime + seconds);
  lastAnimationTimestamp = null;
  drawCurrentAtomFrame();
}

function stopStepHold() {
  if (stepHoldTimeout !== null) {
    clearTimeout(stepHoldTimeout);
    stepHoldTimeout = null;
  }

  if (stepRepeatInterval !== null) {
    clearInterval(stepRepeatInterval);
    stepRepeatInterval = null;
  }
}

function bindStepHold(button, seconds) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    stopStepHold();
    stepAtom(seconds);

    stepHoldTimeout = setTimeout(() => {
      stepAtom(seconds);
      stepRepeatInterval = setInterval(() => {
        stepAtom(seconds);
      }, stepRepeatIntervalMs);
    }, stepHoldDelayMs);
  });

  button.addEventListener("pointerup", stopStepHold);
  button.addEventListener("pointercancel", stopStepHold);
  button.addEventListener("lostpointercapture", stopStepHold);
  button.addEventListener("mouseleave", stopStepHold);
}

function getSelectedPhenomenon() {
  return document.querySelector('input[name="phenomenon"]:checked')?.value || "compton";
}

function startIrradiation() {
  if (getSelectedPhenomenon() === "photoelectric") {
    startPhotoelectricIrradiation();
    return;
  }

  startComptonIrradiation();
}

function startComptonIrradiation() {
  if (radiationButton.disabled) {
    return;
  }

  const metrics = getCanvasMetrics();
  const geometry = getAtomGeometry(metrics);
  const targetPlan = getClosestComptonTarget(geometry, metrics, elapsedTime);

  comptonState = {
    phase: "incoming",
    startTime: elapsedTime,
    scatterTime: null,
    incomingDuration: targetPlan.incomingDuration,
    incomingY: targetPlan.electronY,
    incomingEndX: targetPlan.electronX,
    targetElectronIndex: targetPlan.index,
    interactionPoint: {
      x: targetPlan.electronX,
      y: targetPlan.electronY,
    },
    incomingStartX: -metrics.scale * 0.28,
    results: null,
  };

  radiationButton.disabled = true;
  photoelectricState = null;
  resetComptonPanel();
  setAtomPlaying(true);
}

function startPhotoelectricIrradiation() {
  if (radiationButton.disabled) {
    return;
  }

  const metrics = getCanvasMetrics();
  const geometry = getAtomGeometry(metrics);
  const targetPlan = getPhotoelectricTarget(geometry, metrics, elapsedTime);

  photoelectricState = {
    phase: "incoming",
    startTime: elapsedTime,
    absorptionTime: null,
    transitionStartTime: null,
    transitionEndTime: null,
    incomingDuration: targetPlan.incomingDuration,
    incomingY: targetPlan.electronY,
    incomingEndX: targetPlan.electronX,
    targetElectronIndex: targetPlan.index,
    donorElectronIndex: null,
    donorStart: null,
    interactionPoint: {
      x: targetPlan.electronX,
      y: targetPlan.electronY,
    },
    incomingStartX: -metrics.scale * 0.28,
    results: null,
  };

  radiationButton.disabled = true;
  comptonState = null;
  updatePhotoelectricPanel(calculatePhotoelectricResults());
  setAtomPlaying(true);
}

function restartSimulation() {
  elapsedTime = 0;
  lastAnimationTimestamp = null;
  setAtomPlaying(true);
  comptonState = null;
  photoelectricState = null;
  radiationButton.disabled = false;
  resetPanelForSelectedPhenomenon();
  drawCurrentAtomFrame();
}

function handlePhenomenonChange() {
  comptonState = null;
  photoelectricState = null;
  radiationButton.disabled = false;
  resetPanelForSelectedPhenomenon();
  drawCurrentAtomFrame();
}

function resetPanelForSelectedPhenomenon() {
  if (getSelectedPhenomenon() === "photoelectric") {
    updatePhotoelectricPanel(calculatePhotoelectricResults());
  } else {
    resetComptonPanel();
  }
}

function resetComptonPanel() {
  panelTitle.textContent = "Σκέδαση Compton";
  panelLabels.initialWavelength.textContent = "Αρχικό μήκος κύματος";
  panelLabels.scatterAngle.textContent = "Γωνία φωτονίου";
  panelLabels.wavelengthShift.textContent = "Μεταβολή μήκους κύματος";
  panelLabels.scatteredWavelength.textContent = "Μήκος κύματος μετά";
  panelLabels.scatteredEnergy.textContent = "Ενέργεια φωτονίου μετά";
  panelLabels.electronEnergy.textContent = "Κινητική ενέργεια ηλεκτρονίου";
  panelLabels.electronAngle.textContent = "Γωνία ηλεκτρονίου";
  panelNote.textContent =
    "Η εικόνα του ατόμου είναι απλοποιημένη αναπαράσταση. Στην πραγματικότητα τα ηλεκτρόνια περιγράφονται κβαντομηχανικά.";
  initialWavelengthValue.textContent = `${initialWavelengthNm.toFixed(4)} nm`;
  scatterAngleValue.textContent = "-";
  wavelengthShiftValue.textContent = "-";
  scatteredWavelengthValue.textContent = "-";
  scatteredEnergyValue.textContent = "-";
  electronEnergyValue.textContent = "-";
  electronAngleValue.textContent = "-";
}

function drawCurrentAtomFrame() {
  const metrics = getCanvasMetrics();

  if (metrics.width > 0 && metrics.height > 0) {
    drawNeonAtom(metrics, elapsedTime);
  }
}

function drawNeonAtom(metrics, elapsedTime) {
  const {
    center,
    centerY,
    innerOrbitRadius,
    outerOrbitRadius,
    electronRadius,
    nucleonRadius,
    nucleusRadius,
  } = getAtomGeometry(metrics);
  const innerRotationAngle = getOrbitalRotationAngle(
    elapsedTime,
    innerOrbitRadius,
    metrics,
    innerElectronBeta,
  );
  const outerRotationAngle = getOrbitalRotationAngle(
    elapsedTime,
    outerOrbitRadius,
    metrics,
    outerElectronBeta,
  );

  atomContext.clearRect(0, 0, metrics.width, metrics.height);
  drawOrbit(center, centerY, innerOrbitRadius);
  drawOrbit(center, centerY, outerOrbitRadius);
  drawElectrons(
    center,
    centerY,
    innerOrbitRadius,
    innerElectronAngles,
    electronRadius,
    innerRotationAngle,
    {
      skipIndex: getPhotoelectricInnerSkipIndex(elapsedTime),
    },
  );
  drawElectrons(
    center,
    centerY,
    outerOrbitRadius,
    outerElectronAngles,
    electronRadius,
    outerRotationAngle,
    {
      skipIndex:
        comptonState &&
        elapsedTime >= comptonState.startTime + comptonState.incomingDuration
          ? comptonState.targetElectronIndex
          : photoelectricState &&
              photoelectricState.donorElectronIndex !== null &&
              elapsedTime >= photoelectricState.transitionStartTime
            ? photoelectricState.donorElectronIndex
            : null,
    },
  );
  drawNucleus(center, centerY, nucleusRadius, nucleonRadius);
  drawComptonScene(metrics, elapsedTime, outerOrbitRadius, electronRadius);
  drawPhotoelectricScene(metrics, elapsedTime, electronRadius);
}

function getPhotoelectricInnerSkipIndex(time) {
  if (!photoelectricState) {
    return null;
  }

  const absorptionMoment = photoelectricState.startTime + photoelectricState.incomingDuration;

  if (time < absorptionMoment) {
    return null;
  }

  if (
    photoelectricState.transitionEndTime !== null &&
    time >= photoelectricState.transitionEndTime
  ) {
    return null;
  }

  return photoelectricState.targetElectronIndex;
}

function getCanvasMetrics() {
  const bounds = atomCanvas.getBoundingClientRect();
  const width = Math.round(bounds.width || window.innerWidth || 520);
  const height = Math.round(bounds.height || window.innerHeight || 520);
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const maxPreviousCanvasSize = rootFontSize * 42;
  const scale = Math.min(Math.min(width, height) * 0.72, maxPreviousCanvasSize);

  return {
    width,
    height,
    scale,
  };
}

function getAtomGeometry(metrics) {
  return {
    center: metrics.width / 2,
    centerY: metrics.height / 2,
    innerOrbitRadius: metrics.scale * 0.2,
    outerOrbitRadius: metrics.scale * 0.4,
    electronRadius: Math.max(3, metrics.scale * 0.01),
    nucleonRadius: Math.max(7, metrics.scale * 0.029),
    nucleusRadius: metrics.scale * 0.13,
  };
}

function getPhotonVisualSpeed(metrics) {
  const incomingStartX = -metrics.scale * 0.28;
  return (metrics.width / 2 - incomingStartX) / photonCenterTravelDuration;
}

function getOrbitalRotationAngle(time, orbitRadius, metrics, speedFractionOfC) {
  const angularSpeedRadians = getPhotonVisualSpeed(metrics) * speedFractionOfC / orbitRadius;
  return radiansToDegrees(-angularSpeedRadians * time);
}

function getClosestComptonTarget(geometry, metrics, startTime) {
  const incomingStartX = -metrics.scale * 0.28;
  const incomingY = geometry.centerY - geometry.outerOrbitRadius;
  const incomingSpeed = getPhotonVisualSpeed(metrics);
  const maxIncomingDuration =
    (geometry.center + geometry.outerOrbitRadius - incomingStartX) / incomingSpeed;
  const samples = 260;
  let bestTarget = null;

  for (let sample = 0; sample <= samples; sample += 1) {
    const timeOffset = (maxIncomingDuration * sample) / samples;
    const photonX = incomingStartX + incomingSpeed * timeOffset;
    const photonY = incomingY;
    const absoluteTime = startTime + timeOffset;

    outerElectronAngles.forEach((_, index) => {
      const electron = getOuterElectronPosition(geometry, metrics, index, absoluteTime);
      const distance = Math.hypot(photonX - electron.x, photonY - electron.y);

      if (!bestTarget || distance < bestTarget.distance) {
        bestTarget = {
          index,
          distance,
          incomingDuration: timeOffset,
          incomingY,
          photonX,
          photonY,
          electronX: electron.x,
          electronY: electron.y,
        };
      }
    });
  }

  return bestTarget;
}

function getPhotoelectricTarget(geometry, metrics, startTime) {
  const topElectron = innerElectronAngles
    .map((_, index) => getInnerElectronPosition(geometry, metrics, index, startTime))
    .sort((a, b) => a.y - b.y)[0];
  const incomingStartX = -metrics.scale * 0.28;
  const incomingSpeed = getPhotonVisualSpeed(metrics);
  const maxIncomingDuration =
    (geometry.center + geometry.innerOrbitRadius - incomingStartX) / incomingSpeed;
  const samples = 260;
  let bestTarget = null;

  for (let sample = 0; sample <= samples; sample += 1) {
    const timeOffset = (maxIncomingDuration * sample) / samples;
    const electron = getInnerElectronPosition(geometry, metrics, topElectron.index, startTime + timeOffset);
    const photonX = incomingStartX + incomingSpeed * timeOffset;
    const distance = Math.abs(photonX - electron.x);

    if (!bestTarget || distance < bestTarget.distance) {
      bestTarget = {
        index: topElectron.index,
        distance,
        incomingDuration: timeOffset,
        electronX: electron.x,
        electronY: electron.y,
      };
    }
  }

  return bestTarget;
}

function getInnerElectronPosition(geometry, metrics, index, time) {
  const rotationAngle = getOrbitalRotationAngle(
    time,
    geometry.innerOrbitRadius,
    metrics,
    innerElectronBeta,
  );
  const radians = degreesToRadians(innerElectronAngles[index] + rotationAngle);

  return {
    index,
    x: geometry.center + Math.cos(radians) * geometry.innerOrbitRadius,
    y: geometry.centerY + Math.sin(radians) * geometry.innerOrbitRadius,
  };
}

function getOuterElectronPosition(geometry, metrics, index, time) {
  const rotationAngle = getOrbitalRotationAngle(
    time,
    geometry.outerOrbitRadius,
    metrics,
    outerElectronBeta,
  );
  const radians = degreesToRadians(outerElectronAngles[index] + rotationAngle);

  return {
    index,
    x: geometry.center + Math.cos(radians) * geometry.outerOrbitRadius,
    y: geometry.centerY + Math.sin(radians) * geometry.outerOrbitRadius,
  };
}

function getNearestOuterElectronToPoint(geometry, metrics, point, time) {
  return outerElectronAngles.reduce((nearest, _, index) => {
    const electron = getOuterElectronPosition(geometry, metrics, index, time);
    const distance = Math.hypot(point.x - electron.x, point.y - electron.y);

    if (!nearest || distance < nearest.distance) {
      return { ...electron, distance };
    }

    return nearest;
  }, null);
}

function drawComptonScene(metrics, currentTime, outerOrbitRadius, electronRadius) {
  if (!comptonState) {
    return;
  }

  const geometry = getAtomGeometry(metrics);
  const targetElectron = getOuterElectronPosition(
    geometry,
    metrics,
    comptonState.targetElectronIndex,
    comptonState.startTime + comptonState.incomingDuration,
  );
  const interaction = {
    x: targetElectron.x,
    y: targetElectron.y,
  };
  comptonState.interactionPoint = interaction;

  const scatterMoment = comptonState.startTime + comptonState.incomingDuration;
  const incomingProgress = Math.min(
    1,
    Math.max(0, (currentTime - comptonState.startTime) / comptonState.incomingDuration),
  );

  if (currentTime < scatterMoment) {
    const packetX =
      comptonState.incomingStartX +
      (comptonState.incomingEndX - comptonState.incomingStartX) * incomingProgress;

    if (geometryToggle.checked) {
      drawPhotonIncomingPath(comptonState.incomingStartX, comptonState.incomingY, packetX);
    }

    drawWavePacket({
      x: packetX,
      y: comptonState.incomingY,
      angle: 0,
      wavelength: visualInitialWavelengthPx,
      packetLength: metrics.scale * 0.17,
      amplitude: metrics.scale * 0.0115,
      color: "rgba(125, 211, 252, 0.95)",
      alpha: 1,
    });
    return;
  }

  if (!comptonState.results) {
    comptonState.phase = "scattered";
    comptonState.scatterTime = scatterMoment;
    comptonState.results = calculateComptonScattering();
    updateComptonPanel(comptonState.results);
  }

  const scatterElapsed = Math.max(0, currentTime - scatterMoment);
  const results = comptonState.results;
  const photonVisualSpeed = getPhotonVisualSpeed(metrics);
  const photonDistance = scatterElapsed * photonVisualSpeed;
  const electronDistance = scatterElapsed * photonVisualSpeed * results.electronBeta;
  const visualScatteredWavelength = visualInitialWavelengthPx * results.wavelengthRatio;
  const photonPosition = {
    x: interaction.x + Math.cos(results.photonAngleRad) * photonDistance,
    y: interaction.y + Math.sin(results.photonAngleRad) * photonDistance,
  };
  const electronPosition = {
    x: interaction.x + Math.cos(results.electronAngleRad) * electronDistance,
    y: interaction.y + Math.sin(results.electronAngleRad) * electronDistance,
  };

  if (geometryToggle.checked) {
    drawComptonGeometry({
      interaction,
      photonPosition,
      electronPosition,
      photonAngleRad: results.photonAngleRad,
      electronAngleRad: results.electronAngleRad,
      thetaDeg: results.thetaDeg,
      electronAngleDeg: results.electronAngleDeg,
      incomingStartX: comptonState.incomingStartX,
      incomingY: comptonState.incomingY,
      scale: metrics.scale,
    });
  }

  const vacancy = getOuterElectronPosition(
    geometry,
    metrics,
    comptonState.targetElectronIndex,
    currentTime,
  );
  drawElectronVacancy(vacancy.x, vacancy.y, electronRadius);

  drawWavePacket({
    x: photonPosition.x,
    y: photonPosition.y,
    angle: results.photonAngleRad,
    wavelength: visualScatteredWavelength,
    packetLength: metrics.scale * 0.19,
    amplitude: metrics.scale * 0.01,
    color: "rgba(147, 197, 253, 0.78)",
    alpha: results.energyRatio,
  });

  drawEjectedElectron({
    x: electronPosition.x,
    y: electronPosition.y,
    radius: electronRadius * 1.18,
  });

  if (
    isPlaying &&
    isPointOutsideCanvas(photonPosition, metrics, metrics.scale * 0.2) &&
    isPointOutsideCanvas(electronPosition, metrics, electronRadius * 1.18)
  ) {
    pauseAtom();
  }
}

function drawPhotoelectricScene(metrics, currentTime, electronRadius) {
  if (!photoelectricState) {
    return;
  }

  const geometry = getAtomGeometry(metrics);
  const targetElectron = getInnerElectronPosition(
    geometry,
    metrics,
    photoelectricState.targetElectronIndex,
    photoelectricState.startTime + photoelectricState.incomingDuration,
  );
  const interaction = {
    x: targetElectron.x,
    y: targetElectron.y,
  };
  photoelectricState.interactionPoint = interaction;

  const absorptionMoment = photoelectricState.startTime + photoelectricState.incomingDuration;
  const incomingProgress = Math.min(
    1,
    Math.max(0, (currentTime - photoelectricState.startTime) / photoelectricState.incomingDuration),
  );

  if (currentTime < absorptionMoment) {
    const packetX =
      photoelectricState.incomingStartX +
      (photoelectricState.incomingEndX - photoelectricState.incomingStartX) * incomingProgress;

    if (geometryToggle.checked) {
      drawPhotonIncomingPath(photoelectricState.incomingStartX, photoelectricState.incomingY, packetX);
    }

    drawWavePacket({
      x: packetX,
      y: photoelectricState.incomingY,
      angle: 0,
      wavelength: visualInitialWavelengthPx,
      packetLength: metrics.scale * 0.17,
      amplitude: metrics.scale * 0.0115,
      color: "rgba(125, 211, 252, 0.95)",
      alpha: 1,
    });
    return;
  }

  if (!photoelectricState.results) {
    photoelectricState.phase = "absorbed";
    photoelectricState.absorptionTime = absorptionMoment;
    photoelectricState.transitionStartTime = absorptionMoment + photoelectricVacancyDelay;
    photoelectricState.transitionEndTime =
      photoelectricState.transitionStartTime + photoelectricTransitionDuration;
    photoelectricState.results = calculatePhotoelectricResults();
    const transitionVacancy = getInnerElectronPosition(
      geometry,
      metrics,
      photoelectricState.targetElectronIndex,
      photoelectricState.transitionStartTime,
    );
    const donor = getNearestOuterElectronToPoint(
      geometry,
      metrics,
      transitionVacancy,
      photoelectricState.transitionStartTime,
    );
    photoelectricState.donorElectronIndex = donor.index;
    photoelectricState.donorStart = { x: donor.x, y: donor.y };
    updatePhotoelectricPanel(photoelectricState.results);
  }

  const results = photoelectricState.results;
  const movingVacancy = getInnerElectronPosition(
    geometry,
    metrics,
    photoelectricState.targetElectronIndex,
    currentTime,
  );
  const photonVisualSpeed = getPhotonVisualSpeed(metrics);
  const absorptionElapsed = Math.max(0, currentTime - absorptionMoment);
  const photoelectronDistance = absorptionElapsed * photonVisualSpeed * results.photoelectronBeta;
  const photoelectronAngleRad = degreesToRadians(results.photoelectronAngleDeg);
  const photoelectronPosition = {
    x: interaction.x + Math.cos(photoelectronAngleRad) * photoelectronDistance,
    y: interaction.y + Math.sin(photoelectronAngleRad) * photoelectronDistance,
  };

  if (geometryToggle.checked) {
    drawPhotoelectricGeometry({
      interaction,
      photoelectronPosition,
      incomingStartX: photoelectricState.incomingStartX,
      incomingY: photoelectricState.incomingY,
      scale: metrics.scale,
    });
  }

  if (currentTime < photoelectricState.transitionEndTime) {
    drawElectronVacancy(movingVacancy.x, movingVacancy.y, electronRadius);
  }

  drawEjectedElectron({
    x: photoelectronPosition.x,
    y: photoelectronPosition.y,
    radius: electronRadius * 1.18,
  });

  const transitionProgress = Math.min(
    1,
    Math.max(
      0,
      (currentTime - photoelectricState.transitionStartTime) / photoelectricTransitionDuration,
    ),
  );

  if (transitionProgress > 0 && photoelectricState.donorStart) {
    const transitionTarget = getInnerElectronPosition(
      geometry,
      metrics,
      photoelectricState.targetElectronIndex,
      currentTime,
    );
    const donorX =
      photoelectricState.donorStart.x +
      (transitionTarget.x - photoelectricState.donorStart.x) * easeInOutCubic(transitionProgress);
    const donorY =
      photoelectricState.donorStart.y +
      (transitionTarget.y - photoelectricState.donorStart.y) * easeInOutCubic(transitionProgress);
    const transitionElectronPosition = {
      x: donorX,
      y: donorY,
    };

    if (transitionProgress < 1) {
      drawBoundElectron(transitionElectronPosition.x, transitionElectronPosition.y, electronRadius);
    }

    const movingOuterVacancy = getOuterElectronPosition(
      geometry,
      metrics,
      photoelectricState.donorElectronIndex,
      currentTime,
    );
    drawElectronVacancy(movingOuterVacancy.x, movingOuterVacancy.y, electronRadius);

    const emittedPhotonStartTime =
      photoelectricState.transitionStartTime + photoelectricTransitionDuration * 0.5;
    const emittedPhotonTarget = getInnerElectronPosition(
      geometry,
      metrics,
      photoelectricState.targetElectronIndex,
      emittedPhotonStartTime,
    );
    const emittedPhotonOrigin = {
      x: (photoelectricState.donorStart.x + emittedPhotonTarget.x) / 2,
      y: (photoelectricState.donorStart.y + emittedPhotonTarget.y) / 2,
    };
    let emittedPhotonPosition = null;

    if (currentTime >= emittedPhotonStartTime) {
      const emittedElapsed = currentTime - emittedPhotonStartTime;
      const emittedPhotonAngleRad = degreesToRadians(results.emittedPhotonAngleDeg);
      const emittedPhotonDistance = emittedElapsed * photonVisualSpeed * 0.85;
      emittedPhotonPosition = {
        x: emittedPhotonOrigin.x + Math.cos(emittedPhotonAngleRad) * emittedPhotonDistance,
        y: emittedPhotonOrigin.y + Math.sin(emittedPhotonAngleRad) * emittedPhotonDistance,
      };

      if (geometryToggle.checked) {
        drawGeometryLine(
          emittedPhotonOrigin,
          emittedPhotonPosition,
          "rgba(248, 113, 113, 0.68)",
          [8, 6],
        );
      }

      drawWavePacket({
        x: emittedPhotonPosition.x,
        y: emittedPhotonPosition.y,
        angle: emittedPhotonAngleRad,
        wavelength: visualEmittedWavelengthPx,
        packetLength: metrics.scale * 0.24,
        amplitude: metrics.scale * 0.012,
        color: "rgba(248, 113, 113, 0.92)",
        alpha: 0.86,
      });
    }

    if (geometryToggle.checked) {
      drawGeometryPath(
        getPhotoelectricTransitionPathPoints(photoelectricState, geometry, metrics, currentTime),
        "rgba(250, 204, 21, 0.64)",
        [5, 5],
      );
    }

    if (
      isPlaying &&
      transitionProgress >= 1 &&
      isPointOutsideCanvas(photoelectronPosition, metrics, electronRadius * 1.18) &&
      emittedPhotonPosition &&
      isPointOutsideCanvas(emittedPhotonPosition, metrics, metrics.scale * 0.2)
    ) {
      pauseAtom();
    }
  }
}

function drawPhotoelectricGeometry({ interaction, photoelectronPosition, incomingStartX, incomingY, scale }) {
  drawPhotonIncomingPath(incomingStartX, incomingY, interaction.x);
  drawReferenceExtension(interaction, scale);
  drawGeometryLine(interaction, photoelectronPosition, "rgba(250, 204, 21, 0.62)", [5, 6]);
}

function getPhotoelectricTransitionPathPoints(state, geometry, metrics, currentTime) {
  const startTime = state.transitionStartTime;
  const endTime = state.transitionEndTime;
  const pathEndTime = Math.min(currentTime, endTime);
  const pathDuration = Math.max(0, pathEndTime - startTime);
  const samples = Math.max(2, Math.ceil((pathDuration / photoelectricTransitionDuration) * 28));
  const points = [];

  for (let sample = 0; sample <= samples; sample += 1) {
    const sampleTime = startTime + (pathDuration * sample) / samples;
    const progress = Math.min(
      1,
      Math.max(0, (sampleTime - startTime) / photoelectricTransitionDuration),
    );
    const target = getInnerElectronPosition(
      geometry,
      metrics,
      state.targetElectronIndex,
      sampleTime,
    );
    const easedProgress = easeInOutCubic(progress);

    points.push({
      x: state.donorStart.x + (target.x - state.donorStart.x) * easedProgress,
      y: state.donorStart.y + (target.y - state.donorStart.y) * easedProgress,
    });
  }

  return points;
}

function easeInOutCubic(progress) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function drawPhotonIncomingPath(startX, y, interactionX) {
  atomContext.save();
  atomContext.strokeStyle = "rgba(125, 211, 252, 0.42)";
  atomContext.lineWidth = 2;
  atomContext.setLineDash([8, 8]);
  atomContext.beginPath();
  atomContext.moveTo(startX, y);
  atomContext.lineTo(interactionX, y);
  atomContext.stroke();
  atomContext.restore();
}

function drawComptonGeometry({
  interaction,
  photonPosition,
  electronPosition,
  photonAngleRad,
  electronAngleRad,
  thetaDeg,
  electronAngleDeg,
  incomingStartX,
  incomingY,
  scale,
}) {
  drawPhotonIncomingPath(incomingStartX, incomingY, interaction.x);
  drawReferenceExtension(interaction, scale);
  drawGeometryLine(interaction, photonPosition, "rgba(147, 197, 253, 0.52)", [9, 7]);
  drawGeometryLine(interaction, electronPosition, "rgba(250, 204, 21, 0.62)", [5, 6]);
  drawAngleArc(interaction, 0, photonAngleRad, scale * 0.095, "φ", "#93c5fd");
  drawAngleArc(
    interaction,
    0,
    electronAngleRad,
    scale * 0.14,
    "ψ",
    "#facc15",
  );
}

function drawReferenceExtension(interaction, scale) {
  atomContext.save();
  atomContext.strokeStyle = "rgba(191, 219, 254, 0.22)";
  atomContext.lineWidth = 2;
  atomContext.setLineDash([8, 10]);
  atomContext.beginPath();
  atomContext.moveTo(interaction.x, interaction.y);
  atomContext.lineTo(interaction.x + scale * 0.5, interaction.y);
  atomContext.stroke();
  atomContext.restore();
}

function drawGeometryLine(start, end, color, dashPattern) {
  atomContext.save();
  atomContext.strokeStyle = color;
  atomContext.lineWidth = 2;
  atomContext.setLineDash(dashPattern);
  atomContext.beginPath();
  atomContext.moveTo(start.x, start.y);
  atomContext.lineTo(end.x, end.y);
  atomContext.stroke();
  atomContext.restore();
}

function drawGeometryPath(points, color, dashPattern) {
  if (points.length < 2) {
    return;
  }

  atomContext.save();
  atomContext.strokeStyle = color;
  atomContext.lineWidth = 2;
  atomContext.setLineDash(dashPattern);
  atomContext.beginPath();
  atomContext.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    atomContext.lineTo(points[index].x, points[index].y);
  }

  atomContext.stroke();
  atomContext.restore();
}

function drawAngleArc(origin, startAngle, endAngle, radius, label, color) {
  const counterclockwise = endAngle < startAngle;
  const labelAngle = startAngle + normalizeRadians(endAngle - startAngle) / 2;
  const labelX = origin.x + Math.cos(labelAngle) * (radius + 18);
  const labelY = origin.y + Math.sin(labelAngle) * (radius + 18);

  atomContext.save();
  atomContext.strokeStyle = color;
  atomContext.fillStyle = color;
  atomContext.lineWidth = 2;
  atomContext.beginPath();
  atomContext.arc(origin.x, origin.y, radius, startAngle, endAngle, counterclockwise);
  atomContext.stroke();
  atomContext.font = "700 13px Inter, sans-serif";
  atomContext.textAlign = "center";
  atomContext.textBaseline = "middle";
  atomContext.fillText(label, labelX, labelY);
  atomContext.restore();
}

function normalizeRadians(radians) {
  if (radians > Math.PI) {
    return radians - Math.PI * 2;
  }

  if (radians < -Math.PI) {
    return radians + Math.PI * 2;
  }

  return radians;
}

function isPointOutsideCanvas(point, metrics, margin) {
  return (
    point.x < -margin ||
    point.x > metrics.width + margin ||
    point.y < -margin ||
    point.y > metrics.height + margin
  );
}

function drawWavePacket({ x, y, angle, wavelength, packetLength, amplitude, color, alpha }) {
  const samples = Math.max(220, Math.ceil(packetLength * 1.6));
  const halfLength = packetLength / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  atomContext.save();
  atomContext.lineWidth = 3;
  atomContext.strokeStyle = color;
  atomContext.globalAlpha = Math.max(0.36, alpha);
  atomContext.shadowBlur = 16;
  atomContext.shadowColor = color;
  atomContext.beginPath();

  for (let i = 0; i <= samples; i += 1) {
    const t = -halfLength + (packetLength * i) / samples;
    const envelope = Math.sin((Math.PI * i) / samples);
    const displacement = Math.sin((2 * Math.PI * t) / wavelength) * amplitude * envelope;
    const pointX = x + cos * t - sin * displacement;
    const pointY = y + sin * t + cos * displacement;

    if (i === 0) {
      atomContext.moveTo(pointX, pointY);
    } else {
      atomContext.lineTo(pointX, pointY);
    }
  }

  atomContext.stroke();
  atomContext.restore();
}

function drawElectronVacancy(x, y, radius) {
  atomContext.save();
  atomContext.globalAlpha = 0.72;
  atomContext.strokeStyle = "rgba(250, 204, 21, 0.82)";
  atomContext.lineWidth = 2;
  atomContext.setLineDash([4, 5]);
  atomContext.beginPath();
  atomContext.arc(x, y, radius * 1.55, 0, Math.PI * 2);
  atomContext.stroke();
  atomContext.restore();
}

function drawEjectedElectron({ x, y, radius }) {
  atomContext.save();
  atomContext.shadowBlur = 18;
  atomContext.shadowColor = "#facc15";
  atomContext.fillStyle = "#fde047";
  atomContext.beginPath();
  atomContext.arc(x, y, radius, 0, Math.PI * 2);
  atomContext.fill();
  atomContext.restore();
}

function drawBoundElectron(x, y, radius) {
  atomContext.save();
  atomContext.fillStyle = "#facc15";
  atomContext.beginPath();
  atomContext.arc(x, y, radius, 0, Math.PI * 2);
  atomContext.fill();
  atomContext.restore();
}

function calculateComptonScattering() {
  const theta = sampleKleinNishinaAngle(photonInitialEnergyKeV);
  const scatterSign = Math.random() < 0.5 ? -1 : 1;
  const photonAngleRad = theta * scatterSign;
  const energyRatioDenominator =
    1 + (photonInitialEnergyKeV / electronRestEnergyKeV) * (1 - Math.cos(theta));
  const scatteredEnergyKeV = photonInitialEnergyKeV / energyRatioDenominator;
  const wavelengthShiftNm = electronComptonWavelengthNm * (1 - Math.cos(theta));
  const scatteredWavelengthNm = initialWavelengthNm + wavelengthShiftNm;
  const electronKineticEnergyKeV = Math.max(
    0,
    photonInitialEnergyKeV - scatteredEnergyKeV - electronBindingEnergyKeV,
  );
  const electronAngleMagnitude = Math.atan2(
    scatteredEnergyKeV * Math.sin(theta),
    photonInitialEnergyKeV - scatteredEnergyKeV * Math.cos(theta),
  );
  const electronAngleRad = -scatterSign * electronAngleMagnitude;
  const gamma = 1 + electronKineticEnergyKeV / electronRestEnergyKeV;
  const beta = Math.sqrt(Math.max(0, 1 - 1 / (gamma * gamma)));

  return {
    thetaRad: theta,
    photonAngleRad,
    electronAngleRad,
    thetaDeg: radiansToDegrees(theta),
    electronAngleDeg: radiansToDegrees(electronAngleMagnitude),
    scatteredEnergyKeV,
    wavelengthShiftNm,
    scatteredWavelengthNm,
    electronKineticEnergyKeV,
    wavelengthRatio: scatteredWavelengthNm / initialWavelengthNm,
    energyRatio: scatteredEnergyKeV / photonInitialEnergyKeV,
    electronBeta: beta,
  };
}

function calculatePhotoelectricResults() {
  const photoelectronKineticEnergyKeV = photonInitialEnergyKeV - kShellBindingEnergyKeV;
  const gamma = 1 + photoelectronKineticEnergyKeV / electronRestEnergyKeV;
  const photoelectronBeta = Math.sqrt(Math.max(0, 1 - 1 / (gamma * gamma)));
  const emittedPhotonEnergyKeV = kShellBindingEnergyKeV - lShellBindingEnergyKeV;
  const emittedPhotonWavelengthNm = hcKeVNm / emittedPhotonEnergyKeV;

  return {
    photoelectronKineticEnergyKeV,
    photoelectronBeta,
    photoelectronAngleDeg: randomRange(-60, 60),
    emittedPhotonAngleDeg: randomRange(0, 360),
    emittedPhotonEnergyKeV,
    emittedPhotonWavelengthNm,
  };
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function sampleKleinNishinaAngle(energyKeV) {
  const maxProbability = getKleinNishinaMaxProbability(energyKeV);

  for (let attempts = 0; attempts < 10000; attempts += 1) {
    const theta = Math.random() * Math.PI;
    const probability = kleinNishinaProbability(theta, energyKeV);

    if (Math.random() * maxProbability <= probability) {
      return theta;
    }
  }

  return Math.PI / 2;
}

function getKleinNishinaMaxProbability(energyKeV) {
  let maxProbability = 0;

  for (let i = 1; i < 180; i += 1) {
    maxProbability = Math.max(
      maxProbability,
      kleinNishinaProbability(degreesToRadians(i), energyKeV),
    );
  }

  return maxProbability;
}

function kleinNishinaProbability(theta, energyKeV) {
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const ratio = 1 / (1 + (energyKeV / electronRestEnergyKeV) * (1 - cosTheta));

  return (
    ratio *
    ratio *
    (1 / ratio + ratio - sinTheta * sinTheta) *
    Math.max(0, sinTheta)
  );
}

function updateComptonPanel(results) {
  scatterAngleValue.textContent = `${results.thetaDeg.toFixed(0)}°`;
  wavelengthShiftValue.textContent = `${results.wavelengthShiftNm.toFixed(4)} nm`;
  scatteredWavelengthValue.textContent = `${results.scatteredWavelengthNm.toFixed(4)} nm`;
  scatteredEnergyValue.textContent = `${results.scatteredEnergyKeV.toFixed(1)} keV`;
  electronEnergyValue.textContent = `${results.electronKineticEnergyKeV.toFixed(2)} keV`;
  electronAngleValue.textContent = `${results.electronAngleDeg.toFixed(0)}°`;
}

function updatePhotoelectricPanel(results) {
  panelTitle.textContent = "Φωτοηλεκτρικό φαινόμενο";
  panelLabels.initialWavelength.textContent = "Στιβάδα απορρόφησης";
  panelLabels.scatterAngle.textContent = "Ενέργεια σύνδεσης K";
  panelLabels.wavelengthShift.textContent = "Κινητική ενέργεια φωτοηλεκτρονίου";
  panelLabels.scatteredWavelength.textContent = "Ταχύτητα φωτοηλεκτρονίου";
  panelLabels.scatteredEnergy.textContent = "Μετάπτωση";
  panelLabels.electronEnergy.textContent = "Ενέργεια εκπεμπόμενου φωτονίου";
  panelLabels.electronAngle.textContent = "Μήκος κύματος εκπεμπόμενου φωτονίου";
  panelNote.textContent =
    "Η εικόνα είναι απλοποιημένη αναπαράσταση. Στην πραγματικότητα τα ηλεκτρόνια δεν κινούνται σε κλασικές κυκλικές τροχιές, αλλά περιγράφονται κβαντομηχανικά.";
  initialWavelengthValue.textContent = "K";
  scatterAngleValue.textContent = `${kShellBindingEnergyKeV.toFixed(2)} keV`;
  wavelengthShiftValue.textContent = `${results.photoelectronKineticEnergyKeV.toFixed(2)} keV`;
  scatteredWavelengthValue.textContent = `${results.photoelectronBeta.toFixed(2)}c`;
  scatteredEnergyValue.textContent = "L → K";
  electronEnergyValue.textContent = `${results.emittedPhotonEnergyKeV.toFixed(2)} keV`;
  electronAngleValue.textContent = `${results.emittedPhotonWavelengthNm.toFixed(2)} nm`;
}

function drawOrbit(x, y, radius) {
  atomContext.beginPath();
  atomContext.arc(x, y, radius, 0, Math.PI * 2);
  atomContext.strokeStyle = "rgba(191, 219, 254, 0.58)";
  atomContext.lineWidth = 2;
  atomContext.stroke();
}

function drawElectrons(x, y, radius, angles, electronRadius, rotationAngle, options = {}) {
  atomContext.fillStyle = "#facc15";

  angles.forEach((angle, index) => {
    if (options.skipIndex === index) {
      return;
    }

    const radians = degreesToRadians(angle + rotationAngle);
    atomContext.beginPath();
    atomContext.arc(
      x + Math.cos(radians) * radius,
      y + Math.sin(radians) * radius,
      electronRadius,
      0,
      Math.PI * 2,
    );
    atomContext.fill();
  });
}

function drawNucleus(x, y, nucleusRadius, nucleonRadius) {
  [...nucleons]
    .sort((a, b) => a[3] - b[3])
    .forEach(([type, offsetX, offsetY, offsetZ]) => {
      const depth = (offsetZ + 0.58) / 1.4;
      const sphereProjectionScale = 1 - Math.max(offsetZ, 0) * 0.28;
      const radiusScale = 0.86 + depth * 0.24;
      const nucleonX = x + offsetX * nucleusRadius * sphereProjectionScale;
      const nucleonY = y + offsetY * nucleusRadius * sphereProjectionScale;

      drawNucleon(nucleonX, nucleonY, nucleonRadius * radiusScale, type);
    });
}

function drawNucleon(x, y, radius, type) {
  const gradient = atomContext.createRadialGradient(
    x - radius * 0.32,
    y - radius * 0.36,
    radius * 0.12,
    x,
    y,
    radius,
  );

  if (type === "proton") {
    gradient.addColorStop(0, "#fecaca");
    gradient.addColorStop(0.35, "#ef4444");
    gradient.addColorStop(1, "#991b1b");
  } else {
    gradient.addColorStop(0, "#dbeafe");
    gradient.addColorStop(0.38, "#3b82f6");
    gradient.addColorStop(1, "#1e3a8a");
  }

  atomContext.beginPath();
  atomContext.arc(x, y, radius, 0, Math.PI * 2);
  atomContext.fillStyle = gradient;
  atomContext.fill();
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

resizeAtomCanvas();
setAtomPlaying(true);
requestAnimationFrame(animateAtom);
