let camera = null;
let pose = null;
let isRunning = false;

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const startStopBtn = document.getElementById('startStopBtn');
const deadliftCounter = document.getElementById('deadliftCounter');

let deadliftState = "down"; // Start in the down position
let deadliftCount = 0;
let lastRepTime = 0;
let minKneeAngle = 180;
const minRepTime = 1000; // Minimum time between reps in ms
const formFeedback = document.getElementById('formFeedback');

function calculateAngle(pointA, pointB, pointC) {
    const u = {
        x: pointA.x - pointB.x,
        y: pointA.y - pointB.y,
        z: (pointA.z || 0) - (pointB.z || 0)
    };
    const v = {
        x: pointC.x - pointB.x,
        y: pointC.y - pointB.y,
        z: (pointC.z || 0) - (pointB.z || 0)
    };
    const dot = u.x * v.x + u.y * v.y + u.z * v.z;
    const uLength = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
    const vLength = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const cosTheta = dot / (uLength * vLength);
    const clampedCosTheta = Math.min(1, Math.max(-1, cosTheta));
    const theta = Math.acos(clampedCosTheta);
    return theta * 180 / Math.PI;
}

function calculateSlope(pointA, pointB) {
    return (pointB.y - pointA.y) / (pointB.x - pointA.x);
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
        
        // Get key points for deadlift detection
        const leftShoulder = results.poseLandmarks[11];
        const rightShoulder = results.poseLandmarks[12];
        const leftHip = results.poseLandmarks[23];
        const rightHip = results.poseLandmarks[24];
        const leftKnee = results.poseLandmarks[25];
        const rightKnee = results.poseLandmarks[26];
        const leftAnkle = results.poseLandmarks[27];
        const rightAnkle = results.poseLandmarks[28];
        
        // Calculate angles
        const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
        const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
        
        // Calculate back angle (shoulder to hip)
        const shoulderMid = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2
        };
        const hipMid = {
            x: (leftHip.x + rightHip.x) / 2,
            y: (leftHip.y + rightHip.y) / 2
        };
        
        // Track minimum knee angle during deadlift
        if (deadliftState === "down" && avgKneeAngle < minKneeAngle) {
            minKneeAngle = avgKneeAngle;
        }

        // Deadlift detection logic
        const currentTime = Date.now();
        
        if (avgKneeAngle < 120 && deadliftState === "up" && (currentTime - lastRepTime) > minRepTime) {
            deadliftState = "down";
            minKneeAngle = 180;
        } else if (avgKneeAngle > 160 && deadliftState === "down" && (currentTime - lastRepTime) > minRepTime) {
            // Check if back is relatively straight (small angle between shoulders and hips)
            const backAngle = Math.abs(Math.atan2(
                shoulderMid.y - hipMid.y,
                shoulderMid.x - hipMid.x
            ) * 180 / Math.PI);
            
            // Only count if back angle is within a reasonable range (not rounded)
            if (backAngle > 60 && backAngle < 120) {
                deadliftCount++;
                deadliftCounter.innerText = deadliftCount;
                formFeedback.textContent = minKneeAngle < 90 ? 'Good form!' : 'Try to go lower';
                formFeedback.style.color = minKneeAngle < 90 ? '#4CAF50' : '#FF9800';
                deadliftState = "up";
                lastRepTime = currentTime;
            }
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
    
    deadliftCount = 0;
    deadliftState = "down";
    deadliftCounter.innerText = deadliftCount;

    // Hide camera status when camera is active
    const cameraStatus = document.querySelector('.camera-status-container');
    if (cameraStatus) {
        cameraStatus.style.display = 'none';
    }

    startStopBtn.textContent = 'Stop Camera';
    startStopBtn.className = 'stop';
}

function stopCamera() {
    if (camera) {
        camera.stop();
        isRunning = false;
    }
    
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Show camera status when camera is stopped
    const cameraStatus = document.querySelector('.camera-status-container');
    if (cameraStatus) {
        cameraStatus.style.display = 'block';
    }
    
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
