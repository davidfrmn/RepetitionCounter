let camera = null;
let pose = null;
let isRunning = false;

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const startStopBtn = document.getElementById('startStopBtn');

const leftCounter = document.getElementById('leftCounter');
const rightCounter = document.getElementById('rightCounter');


var left_state = "bent";
var right_state = "bent";
var left_count = 0;
var right_count = 0;


function calculateAngle(a, b, c) {
    const u = { x:a.x-b.x,
                y: a.y - b.y,
                z: a.z - b.z
    };
    const v = {
        x: c.x - b.x,
        y: c.y - b.y,
        z: c.z - b.z
    };
    const dot = u.x * v.x + u.y * v.y + u.z * v.z;
    const u_length = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
    const v_length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    const cos_theta = dot / (u_length * v_length);

    const clamped_cos_theta = Math.min(1, Math.max(-1, cos_theta));
    const theta = Math.acos(clamped_cos_theta);
    return theta * 180 / Math.PI;
}

function calculate2DAngle(a, b, c) {
    const u = { x:a.x-b.x,
                y: a.y - b.y
    };
    const v = {
        x: c.x - b.x,
        y: c.y - b.y
    };
    const dot = u.x * v.x + u.y * v.y;
    const u_length = Math.sqrt(u.x * u.x + u.y * u.y);
    const v_length = Math.sqrt(v.x * v.x + v.y * v.y);
    const cos_theta = dot / (u_length * v_length);
    const theta = Math.acos(cos_theta);
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
        
        
        var leftShoulder = results.poseLandmarks[11];
        var rightShoulder = results.poseLandmarks[12];
        var leftElbow = results.poseLandmarks[13];
        var rightElbow = results.poseLandmarks[14];
        var leftWrist = results.poseLandmarks[15];
        var rightWrist = results.poseLandmarks[16];
        
        var leftAngle = calculate2DAngle(leftShoulder, leftElbow, leftWrist);
        var rightAngle = calculate2DAngle(rightShoulder, rightElbow, rightWrist);
        
        

        if (leftAngle<60 && left_state=="straight") {
            left_count++;
            left_state = "bent";
            leftCounter.innerText = left_count;
        } else if (leftAngle>120 && left_state=="bent") {
            left_state = "straight";
        }
        
        if (rightAngle<60 && right_state=="straight") {
            right_count++;
            right_state = "bent";
            rightCounter.innerText = right_count;
        } else if (rightAngle>120 && right_state=="bent"){
            right_state = "straight";
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
    
    left_count = 0;
    left_state = "bent";
    leftCounter.innerText = left_count;
    
    right_count = 0;
    right_state = "bent";
    rightCounter.innerText = right_count;

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