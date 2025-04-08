let model, webcam, ctx, labelContainer, maxPredictions;
const poseImages = new Map();
let currentPoseImage = null;
let currentPoseIndex = 0;
let poseHoldTimer = 3;
let lastPoseTime = 0;
const poseOrder = ['Pose1', 'Pose2', 'Pose3', 'Pose4', 'Pose5', 'Pose6'];

// Event Listeners
document.getElementById('start-button').addEventListener('click', startRecognition);
document.getElementById('back-button').addEventListener('click', showSettingsPage);
document.getElementById('pose1-image').addEventListener('change', (e) => handleImageUpload(e, 'Pose1'));
document.getElementById('pose2-image').addEventListener('change', (e) => handleImageUpload(e, 'Pose2'));
document.getElementById('pose3-image').addEventListener('change', (e) => handleImageUpload(e, 'Pose3'));
document.getElementById('pose4-image').addEventListener('change', (e) => handleImageUpload(e, 'Pose4'));
document.getElementById('pose5-image').addEventListener('change', (e) => handleImageUpload(e, 'Pose5'));
document.getElementById('pose6-image').addEventListener('change', (e) => handleImageUpload(e, 'Pose6'));

function handleImageUpload(event, poseName) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(`${poseName.toLowerCase()}-preview`);
            preview.src = e.target.result;
            preview.style.display = 'block';
            poseImages.set(poseName, e.target.result);
            localStorage.setItem(`pose_${poseName}`, e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    ['Pose1', 'Pose2', 'Pose3', 'Pose4', 'Pose5', 'Pose6'].forEach(poseName => {
        const savedImage = localStorage.getItem(`pose_${poseName}`);
        if (savedImage) {
            const preview = document.getElementById(`${poseName.toLowerCase()}-preview`);
            preview.src = savedImage;
            preview.style.display = 'block';
            poseImages.set(poseName, savedImage);
        }
    });
});

function showSettingsPage() {
    document.getElementById('recognition-page').classList.remove('active');
    document.getElementById('settings-page').classList.add('active');
    if (webcam) {
        webcam.stop();
    }
}

async function startRecognition() {
    if (poseImages.size < 6) {
        alert('Please upload all six pose images first');
        return;
    }
    
    document.getElementById('settings-page').classList.remove('active');
    document.getElementById('recognition-page').classList.add('active');
    
    const URL = document.getElementById('model-url').value;
    await init(URL);
}

async function init(URL) {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    const size = 640;
    const flip = true;
    webcam = new tmPose.Webcam(size, size, flip);
    await webcam.setup();
    await webcam.play();

    canvas = document.getElementById('output');
    ctx = canvas.getContext('2d');
    labelContainer = document.getElementById('pose-name');

    canvas.width = size;
    canvas.height = size;

    window.requestAnimationFrame(loop);
}

async function loop(timestamp) {
    webcam.update();
    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);

    ctx.drawImage(webcam.canvas, 0, 0);
    if (pose) {
        drawPose(pose);
    }

    let maxConfidence = 0;
    let bestPose = '';
    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > maxConfidence) {
            maxConfidence = prediction[i].probability;
            bestPose = prediction[i].className;
        }
    }

    const expectedPose = poseOrder[currentPoseIndex];
    const currentPose = document.getElementById('current-pose');
    currentPose.src = poseImages.get(expectedPose);
    currentPose.style.display = 'block';

    if (maxConfidence > 0.5 && bestPose === expectedPose) {
        if (lastPoseTime === 0) {
            lastPoseTime = Date.now();
        }
        const holdTime = 3 - Math.floor((Date.now() - lastPoseTime) / 1000);
        
        if (holdTime <= 0) {
            currentPoseIndex = (currentPoseIndex + 1) % poseOrder.length;
            lastPoseTime = 0;
        }
        
        labelContainer.textContent = `Current Pose: ${bestPose}\nConfidence: ${(maxConfidence * 100).toFixed(2)}%\nHold for: ${Math.max(0, holdTime)}s`;
    } else {
        lastPoseTime = 0;
        labelContainer.textContent = `Expected Pose: ${expectedPose}\nCurrent Pose: ${bestPose}\nConfidence: ${(maxConfidence * 100).toFixed(2)}%`;
    }
}

function drawPose(pose) {
    // Define the connections between keypoints that form the skeleton
    const connections = [
        ['nose', 'leftEye'], ['leftEye', 'leftEar'], ['nose', 'rightEye'],
        ['rightEye', 'rightEar'], ['nose', 'shoulders'], ['shoulders', 'leftShoulder'],
        ['shoulders', 'rightShoulder'], ['leftShoulder', 'leftElbow'],
        ['leftElbow', 'leftWrist'], ['rightShoulder', 'rightElbow'],
        ['rightElbow', 'rightWrist'], ['shoulders', 'hips'], ['hips', 'leftHip'],
        ['hips', 'rightHip'], ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
        ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle']
    ];

    // Create a map of keypoints for easy access
    const keypointMap = {};
    pose.keypoints.forEach(keypoint => {
        keypointMap[keypoint.name] = keypoint;
    });

    // Draw the lines
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    connections.forEach(([p1Name, p2Name]) => {
        const p1 = keypointMap[p1Name];
        const p2 = keypointMap[p2Name];

        if (p1 && p2 && p1.score > 0.2 && p2.score > 0.2) {
            ctx.beginPath();
            ctx.moveTo(p1.position.x, p1.position.y);
            ctx.lineTo(p2.position.x, p2.position.y);
            ctx.stroke();
        }
    });

    // Draw the keypoints
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.2) {
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 3, 0, 2 * Math.PI);
            ctx.fillStyle = '#ff0000';
            ctx.fill();
        }
    });
}