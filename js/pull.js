let camera = null;
let pose = null;
let isRunning = false;

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const startStopBtn = document.getElementById('startStopBtn');
const leftCounter = document.getElementById('leftCounter');
const rightCounter = document.getElementById('rightCounter');

let leftState = "bent";
let rightState = "bent";
let leftCount = 0;
let rightCount = 0;

function calculateAngle(pointA, pointB, pointC) {
    const u = {
        x: pointA.x - pointB.x,
        y: pointA.y - pointB.y,
        z: pointA.z - pointB.z
    };
    const v = {
        x: pointC.x - pointB.x,
        y: pointC.y - pointB.y,
        z: pointC.z - pointB.z
    };
    const dot = u.x * v.x + u.y * v.y + u.z * v.z;
    const uLength = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
    const vLength = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const cosTheta = dot / (uLength * vLength);
    const clampedCosTheta = Math.min(1, Math.max(-1, cosTheta));
    const theta = Math.acos(clampedCosTheta);
    return theta * 180 / Math.PI;
}

function calculate2DAngle(pointA, pointB, pointC) {
    const u = {
        x: pointA.x - pointB.x,
        y: pointA.y - pointB.y
    };
    const v = {
        x: pointC.x - pointB.x,
        y: pointC.y - pointB.y
    };
    const dot = u.x * v.x + u.y * v.y;
    const uLength = Math.sqrt(u.x * u.x + u.y * u.y);
    const vLength = Math.sqrt(v.x * v.x + v.y * v.y);
    const cosTheta = dot / (uLength * vLength);
    const theta = Math.acos(cosTheta);
    return theta * 180 / Math.PI;
}

function onResults(results) {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    
    if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                        {color: '#b7bdf8', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks,
                    {color: '#c6a0f6', lineWidth: 2, radius: 6});
        
        const leftShoulder = results.poseLandmarks[11];
        const rightShoulder = results.poseLandmarks[12];
        const leftElbow = results.poseLandmarks[13];
        const rightElbow = results.poseLandmarks[14];
        const leftWrist = results.poseLandmarks[15];
        const rightWrist = results.poseLandmarks[16];
        
        const leftAngle = calculate2DAngle(leftShoulder, leftElbow, leftWrist);
        const rightAngle = calculate2DAngle(rightShoulder, rightElbow, rightWrist);

        if (leftAngle < 60 && leftState === "straight") {
            leftCount++;
            leftState = "bent";
            leftCounter.innerText = leftCount;
        } else if (leftAngle > 120 && leftState === "bent") {
            leftState = "straight";
        }
        
        if (rightAngle < 60 && rightState === "straight") {
            rightCount++;
            rightState = "bent";
            rightCounter.innerText = rightCount;
        } else if (rightAngle > 120 && rightState === "bent") {
            rightState = "straight";
        }
    }
    
    canvasCtx.restore();
}

async function initializePose() {
    pose = new Pose({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
    });
    
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    pose.onResults(onResults);
}

async function startCamera() {
    if (!pose) {
        await initializePose();
    }
    
    camera = new Camera(videoElement, {
        onFrame: async () => {
            if (isRunning) {
                await pose.send({image: videoElement});
            }
        },
        width: 640,
        height: 480
    });
    
    await camera.start();
    isRunning = true;
    
    leftCount = 0;
    leftState = "bent";
    leftCounter.innerText = leftCount;
    
    rightCount = 0;
    rightState = "bent";
    rightCounter.innerText = rightCount;

    startStopBtn.textContent = 'Stop Camera';
    startStopBtn.className = 'stop';
}

function stopCamera() {
    if (camera) {
        camera.stop();
        isRunning = false;
    }
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    startStopBtn.textContent = 'Start Camera';
    startStopBtn.className = '';
}

async function toggleCamera() {
    if (isRunning) {
        stopCamera();
    } else {
        await startCamera();
    }
}