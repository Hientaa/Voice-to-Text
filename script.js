// ==========================================
// محوّل الكلام إلى نص — جمعية حنطة الخيرية التنموية
// النسخة النهائية الكاملة
// ==========================================

// ==========================================
// 1. متغيرات عامة
// ==========================================
let recognition = null;
let isRecording = false;
let finalTranscript = '';
let audioContext = null;
let mediaStream = null;
let gainNode = null;
let analyser = null;
let animationFrameId = null;
let currentGain = 3;

// متغيرات Whisper (لمعالجة الملفات الصوتية)
let whisperPipeline = null;
let whisperLoading = false;

// ==========================================
// 2. عناصر الصفحة
// ==========================================
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const viewBtn = document.getElementById('viewBtn');
const copyBtn = document.getElementById('copyBtn');
const clearBtn = document.getElementById('clearBtn');
const transcriptEl = document.getElementById('transcript');
const interimEl = document.getElementById('interim');
const statusEl = document.getElementById('status');
const languageSelect = document.getElementById('language');
const gainSlider = document.getElementById('gainSlider');
const gainValue = document.getElementById('gainValue');
const sensitivityToggle = document.getElementById('sensitivityToggle');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modalText');
const closeModal = document.getElementById('closeModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCopyBtn = document.getElementById('modalCopyBtn');
const fileProgress = document.getElementById('fileProgress');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const toastEl = document.getElementById('toast');

// ==========================================
// 3. إشعار Toast
// ==========================================
let toastTimeout = null;
function showToast(message, duration = 2500) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, duration);
}

// ==========================================
// 4. شريط التقدم
// ==========================================
function showProgress(label, percent) {
    fileProgress.classList.remove('hidden');
    progressLabel.textContent = label;
    progressPercent.textContent = percent + '%';
    progressFill.style.width = percent + '%';

    if (percent >= 100) {
        progressFill.classList.add('complete');
    } else {
        progressFill.classList.remove('complete');
    }
}

function hideProgress() {
    fileProgress.classList.add('hidden');
    progressFill.style.width = '0%';
    progressFill.classList.remove('complete');
}

function hideProgressDelayed(delay = 1500) {
    setTimeout(hideProgress, delay);
}

// ==========================================
// 5. تهيئة التعرف على الكلام المباشر
// ==========================================
function initSpeechRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showError('متصفحك لا يدعم التعرف على الكلام. استخدم Google Chrome أو Microsoft Edge.');
        return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageSelect.value;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        updateUI(true);
        statusEl.textContent = '🔴 جارٍ التسجيل... تحدث الآن بوضوح';
        statusEl.className = 'status-box recording';
    };

    recognition.onresult = (event) => {
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimText += transcript;
            }
        }

        transcriptEl.textContent = finalTranscript.trim() || 'سيظهر النص هنا...';
        interimEl.textContent = interimText;

        const hasText = finalTranscript.trim().length > 0;
        viewBtn.disabled = !hasText;
        copyBtn.disabled = !hasText;
        clearBtn.disabled = !hasText;
    };

    recognition.onerror = (event) => {
        console.error('خطأ في التعرف على الكلام:', event.error);

        if (event.error === 'not-allowed') {
            showError('تم رفض الوصول إلى الميكروفون. يرجى السماح بالوصول.');
        } else if (event.error === 'no-speech') {
            // لا يوجد كلام، تجاهل
        } else if (event.error === 'aborted') {
            // تم الإيقاف يدوياً، تجاهل
        } else if (event.error === 'network') {
            showError('مشكلة في الاتصال بالشبكة. تحقق من الإنترنت.');
        } else {
            showError('حدث خطأ: ' + event.error);
        }
    };

    recognition.onend = () => {
        if (isRecording) {
            try {
                recognition.start();
            } catch (e) {
                console.log('إعادة التشغيل التلقائي:', e);
            }
        }
    };

    return true;
}

// ==========================================
// 6. تضخيم الصوت وزيادة الحساسية
// ==========================================
async function setupMicrophoneGain(stream) {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        mediaStream = stream;

        const source = audioContext.createMediaStreamSource(stream);

        gainNode = audioContext.createGain();
        gainNode.gain.value = currentGain;

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;

        source.connect(analyser);
        source.connect(gainNode);

        adjustGainDynamically();

        console.log('✅ تضخيم الصوت مفعّل:', currentGain + 'x');
    } catch (e) {
        console.warn('⚠️ تعذر تفعيل تضخيم الصوت:', e);
    }
}

function adjustGainDynamically() {
    if (!analyser || !gainNode) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function update() {
        if (!isRecording) return;

        analyser.getByteFrequencyData(dataArray);
        const avgVolume = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

        if (sensitivityToggle.checked) {
            // وضع التقاط الهمس — كسب مضاعف ثابت
            gainNode.gain.value = Math.min(currentGain * 2, 15);
        } else {
            if (avgVolume < 10) {
                gainNode.gain.value = Math.min(currentGain * 2, 15);
            } else if (avgVolume < 25) {
                gainNode.gain.value = Math.min(currentGain * 1.5, 12);
            } else if (avgVolume < 50) {
                gainNode.gain.value = currentGain;
            } else {
                gainNode.gain.value = Math.max(currentGain * 0.8, 1);
            }
        }

        gainValue.textContent = gainNode.gain.value.toFixed(1) + 'x';
        animationFrameId = requestAnimationFrame(update);
    }

    update();
}

// ==========================================
// 7. بدء التسجيل المباشر
// ==========================================
async function startRecording() {
    if (whisperLoading) {
        showToast('⚠️ جارٍ معالجة ملف صوتي، يرجى الانتظار');
        return;
    }

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false
            }
        });

        await setupMicrophoneGain(mediaStream);

        if (!recognition) {
            if (!initSpeechRecognition()) return;
        }

        recognition.lang = languageSelect.value;
        recognition.start();

    } catch (e) {
        console.error('خطأ في بدء التسجيل:', e);
        showError('تعذر الوصول إلى الميكروفون. يرجى السماح بالوصول.');
    }
}

// ==========================================
// 8. إيقاف التسجيل
// ==========================================
function stopRecording() {
    isRecording = false;

    if (recognition) {
        try { recognition.stop(); } catch (e) {}
    }

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }

    gainNode = null;
    analyser = null;

    updateUI(false);
    statusEl.textContent = '⏹️ تم إيقاف التسجيل';
    statusEl.className = 'status-box';
}

// ==========================================
// 9. تحديث الواجهة
// ==========================================
function updateUI(recording) {
    startBtn.disabled = recording;
    stopBtn.disabled = !recording;
    languageSelect.disabled = recording;
}

function showError(message) {
    statusEl.textContent = '❌ ' + message;
    statusEl.className = 'status-box error';
    if (isRecording) stopRecording();
}

// ==========================================
// 10. عرض النص الكامل
// ==========================================
function showFullText() {
    modalText.textContent = finalTranscript.trim() || 'لا يوجد نص لعرضه';
    modal.classList.remove('hidden');
}

// ==========================================
// 11. نسخ النص
// ==========================================
async function copyTranscript() {
    const text = finalTranscript.trim();
    if (!text) return;

    try {
        await navigator.clipboard.writeText(text);
        showToast('✅ تم نسخ النص');
    } catch (e) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('✅ تم نسخ النص');
        } catch (err) {
            showToast('❌ تعذر نسخ النص');
        }
        document.body.removeChild(textarea);
    }
}

// ==========================================
// 12. مسح النص
// ==========================================
function clearTranscript() {
    if (isRecording) return;

    finalTranscript = '';
    transcriptEl.textContent = 'سيظهر النص هنا...';
    interimEl.textContent = '';
    viewBtn.disabled = true;
    copyBtn.disabled = true;
    clearBtn.disabled = true;

    const oldInfo = document.getElementById('currentFileInfo');
    if (oldInfo) oldInfo.remove();

    showToast('🗑️ تم مسح النص');
}

// ==========================================
// 13. تحميل نموذج Whisper
// ==========================================
async function loadWhisperModel() {
    if (whisperPipeline) return whisperPipeline;

    if (whisperLoading) {
        while (whisperLoading) {
            await new Promise(r => setTimeout(r, 200));
        }
        return whisperPipeline;
    }

    whisperLoading = true;
    showProgress('جارٍ تحميل نموذج التعرف (قد يستغرق دقيقة في المرة الأولى)...', 0);

    try {
        const { pipeline, env } = await import(
            'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2'
        );

        env.allowLocalModels = false;
        env.useBrowserCache = true;

        whisperPipeline = await pipeline(
            'automatic-speech-recognition',
            'Xenova/whisper-small',
            {
                quantized: true,
                progress_callback: (data) => {
                    if (data.status === 'progress' && data.progress) {
                        const pct = Math.round(data.progress);
                        showProgress(
                            `جارٍ تحميل النموذج: ${data.file || ''}`,
                            pct
                        );
                    } else if (data.status === 'ready') {
                        showProgress('النموذج جاهز ✅', 100);
                    }
                }
            }
        );

        whisperLoading = false;
        return whisperPipeline;

    } catch (e) {
        whisperLoading = false;
        console.error('فشل تحميل Whisper:', e);
        throw new Error('تعذر تحميل نموذج التعرف على الصوت');
    }
}

// ==========================================
// 14. فك ترميز الملف الصوتي
// ==========================================
async function decodeAudioFile(file) {
    showProgress('جارٍ قراءة الملف الصوتي...', 5);

    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
    });

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    let audioData;
    if (audioBuffer.sampleRate === 16000) {
        audioData = audioBuffer.getChannelData(0);
    } else {
        const offlineCtx = new OfflineAudioContext(
            1,
            Math.ceil(audioBuffer.duration * 16000),
            16000
        );
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start();
        const rendered = await offlineCtx.startRendering();
        audioData = rendered.getChannelData(0);
    }

    await audioCtx.close();
    return audioData;
}

// ==========================================
// 15. معالجة الملف الصوتي
// ==========================================
async function processAudioFile(file) {
    if (isRecording) {
        showError('يرجى إيقاف التسجيل المباشر أولاً');
        return;
    }

    if (!file) return;

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

    // إزالة معلومات ملف سابقة
    const oldInfo = document.getElementById('currentFileInfo');
    if (oldInfo) oldInfo.remove();

    // عرض معلومات الملف
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.id = 'currentFileInfo';
    fileInfo.innerHTML = `
        <span>🎵 ${file.name}</span>
        <span class="file-size">${sizeMB} ميجابايت</span>
    `;

    const transcriptArea = document.querySelector('.transcript-area');
    transcriptArea.parentNode.insertBefore(fileInfo, transcriptArea);

    uploadBtn.disabled = true;
    startBtn.disabled = true;
    statusEl.textContent = '🎧 جارٍ معالجة الملف الصوتي...';
    statusEl.className = 'status-box processing';

    try {
        const transcriber = await loadWhisperModel();

        showProgress('جارٍ تحليل الموجات الصوتية...', 15);
        const audioData = await decodeAudioFile(file);

        const durationSec = (audioData.length / 16000).toFixed(1);
        showProgress(`جارٍ التعرف على الكلام (مدة الملف: ${durationSec} ثانية)...`, 30);

        // تحديد اللغة بناءً على الاختيار
        let whisperLang = 'arabic';
        if (languageSelect.value.startsWith('en')) whisperLang = 'english';
        else if (languageSelect.value.startsWith('fr')) whisperLang = 'french';

        const result = await transcriber(audioData, {
            language: whisperLang,
            task: 'transcribe',
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: false
        });

        showProgress('تمت المعالجة بنجاح ✅', 100);

        const text = (result.text || '').trim();

        if (text) {
            if (finalTranscript) {
                finalTranscript += '\n\n--- من ملف صوتي ---\n' + text + ' ';
            } else {
                finalTranscript = text + ' ';
            }

            transcriptEl.textContent = finalTranscript.trim();
            viewBtn.disabled = false;
            copyBtn.disabled = false;
            clearBtn.disabled = false;

            statusEl.textContent = '✅ تم تحويل الملف الصوتي بنجاح';
            statusEl.className = 'status-box success';
            showToast('✅ تم تحويل الملف الصوتي');
        } else {
            statusEl.textContent = '⚠️ لم يتم التعرف على أي كلام في الملف';
            statusEl.className = 'status-box error';
        }

        hideProgressDelayed(2000);

    } catch (e) {
        console.error('خطأ في معالجة الملف:', e);
        showError('تعذر معالجة الملف: ' + e.message);
        hideProgress();
    } finally {
        uploadBtn.disabled = false;
        startBtn.disabled = false;
        fileInput.value = '';
    }
}

// ==========================================
// 16. ربط الأحداث
// ==========================================

// الأزرار الرئيسية
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);

// الأزرار السفلية
viewBtn.addEventListener('click', showFullText);
copyBtn.addEventListener('click', copyTranscript);
clearBtn.addEventListener('click', clearTranscript);

// النافذة المنبثقة
closeModal.addEventListener('click', () => modal.classList.add('hidden'));
modalCloseBtn.addEventListener('click', () => modal.classList.add('hidden'));
modalCopyBtn.addEventListener('click', async () => {
    await copyTranscript();
    modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
});

// تغيير اللغة
languageSelect.addEventListener('change', () => {
    if (recognition && !isRecording) {
        recognition.lang = languageSelect.value;
    }
});

// شريط الحساسية
gainSlider.addEventListener('input', (e) => {
    currentGain = parseFloat(e.target.value);
    gainValue.textContent = currentGain + 'x';
    if (gainNode && !sensitivityToggle.checked) {
        gainNode.gain.value = currentGain;
    }
});

// تفعيل وضع الهمس
sensitivityToggle.addEventListener('change', () => {
    if (sensitivityToggle.checked) {
        showToast('🔊 وضع التقاط الهمس مفعّل');
    } else {
        showToast('🔉 وضع التقاط الهمس معطّل');
    }
});

// زر تحميل الملف الصوتي
uploadBtn.addEventListener('click', () => {
    if (isRecording) {
        showToast('⚠️ يرجى إيقاف التسجيل المباشر أولاً');
        return;
    }
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) processAudioFile(file);
});

// السحب والإفلات
document.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        processAudioFile(file);
    }
});

// اختصارات لوحة المفاتيح
document.addEventListener('keydown', (e) => {
    // Escape لإغلاق النافذة
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
    }
});

// ==========================================
// 17. فحص المتصفح عند التحميل
// ==========================================
window.addEventListener('load', () => {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showError('متصفحك لا يدعم التعرف المباشر على الكلام. استخدم Google Chrome أو Microsoft Edge. يمكنك مع ذلك استخدام ميزة تحميل الملفات الصوتية.');
    }

    // تحديث سنة الحقوق في التذييل
    const yearEl = document.getElementById('currentYear');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
});

// ==========================================
// 18. تنظيف عند إغلاق الصفحة
// ==========================================
window.addEventListener('beforeunload', () => {
    if (isRecording) stopRecording();
});