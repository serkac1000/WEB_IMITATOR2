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
document.getElementById('save-button').addEventListener('click', saveSettings);

function saveSettings() {
    const modelUrl = document.getElementById('model-url').value;
    localStorage.setItem('model_url', modelUrl);
    alert('Settings saved successfully!');
}
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

    const expectedPoseEl = document.getElementById('expected-pose');
    const currentPoseEl = document.getElementById('current-pose-text');
    const confidenceBar = document.getElementById('confidence-bar');
    const confidenceText = document.getElementById('confidence-text');

    expectedPoseEl.textContent = expectedPose;
    currentPoseEl.textContent = bestPose;

    // Update confidence bar
    const confidencePercent = (maxConfidence * 100).toFixed(1);
    confidenceBar.style.width = `${confidencePercent}%`;
    confidenceText.textContent = `${confidencePercent}%`;

    // Update color coding
    expectedPoseEl.className = 'pose-value ' + (bestPose === expectedPose ? 'correct' : 'incorrect');
    currentPoseEl.className = 'pose-value ' + (bestPose === expectedPose ? 'correct' : 'incorrect');

    const timerEl = document.getElementById('timer');
    if (maxConfidence > 0.7 && bestPose === expectedPose) {
        if (lastPoseTime === 0) {
            lastPoseTime = Date.now();
            console.log('Started holding pose:', expectedPose);
        }
        const holdTime = 3 - Math.floor((Date.now() - lastPoseTime) / 1000);
        
        timerEl.textContent = holdTime + 's';
        timerEl.style.backgroundColor = '#4CAF50'; // Green background
        timerEl.style.display = 'block';
        
        if (holdTime <= 0) {
            console.log('Switching from', expectedPose, 'to next pose');
            currentPoseIndex = (currentPoseIndex + 1) % poseOrder.length;
            lastPoseTime = 0;
            
            // Update display immediately
            const nextPose = poseOrder[currentPoseIndex];
            expectedPoseEl.textContent = nextPose;
            currentPose.src = poseImages.get(nextPose);
            timerEl.style.display = 'none';
        }
    } else {
        if (lastPoseTime !== 0) {
            console.log('Reset hold timer - pose lost or incorrect');
        }
        lastPoseTime = 0;
        timerEl.textContent = '3s';
        timerEl.style.backgroundColor = '#f44336'; // Red background
        timerEl.style.display = 'block';
    }
}

function drawPose(pose) {
    const connections = [
        [5, 7], [7, 9], // Left arm
        [6, 8], [8, 10], // Right arm
        [5, 6], // Shoulders
        [5, 11], [6, 12], // Torso
        [11, 13], [13, 15], // Left leg
        [12, 14], [14, 16], // Right leg
        [11, 12], // Hips
    ];

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;

    connections.forEach(([p1, p2]) => {
        const point1 = pose.keypoints[p1];
        const point2 = pose.keypoints[p2];

        if (point1.score > 0.7 && point2.score > 0.7) {
            ctx.beginPath();
            ctx.moveTo(point1.position.x, point1.position.y);
            ctx.lineTo(point2.position.x, point2.position.y);
            ctx.stroke();
        }
    });

    // Small dots at joints
    pose.keypoints.forEach(keypoint => {
        if (keypoint.score > 0.7) {
            ctx.beginPath();
            ctx.arc(keypoint.position.x, keypoint.position.y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#ff0000';
            ctx.fill();
        }
    });
}