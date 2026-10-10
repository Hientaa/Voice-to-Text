// ==========================================
// محوّل الكلام إلى نص — جمعية حنطة الخيرية التنموية
// نسخة متوافقة مع الجوال (مُصلَحة)
// ==========================================

// ==========================================
// 1. متغيرات عامة
// ==========================================
let recognition = null;
let isRecording = false;
let finalTranscript = '';
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 50;

// متغيرات Whisper
let whisperPipeline = null;
let whisperLoading = false;

// كشف نوع الجهاز
const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

// ==========================================
// 2. عناصر الصفحة
// ==========================================
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const viewBtn = document.getElementById('viewBtn');
const copyBtn = document.getElementById('copyBtn');
const pdfBtn = document.getElementById('pdfBtn');
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
        showError('متصفحك لا يدعم التعرف على الكلام. استخدم Google Chrome على Android أو Safari على iPhone.');
        return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageSelect.value;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        restartAttempts = 0;
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
        pdfBtn.disabled = !hasText;
        clearBtn.disabled = !hasText;
    };

    recognition.onerror = (event) => {
        console.error('خطأ في التعرف على الكلام:', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            showError('تم رفض الوصول إلى الميكروفون. يرجى السماح بالوصول من إعدادات المتصفح.');
            isRecording = false;
        } else if (event.error === 'no-speech') {
            // لا يوجد كلام، تجاهل — إعادة التشغيل ستتم في onend
        } else if (event.error === 'aborted') {
            // تم الإيقاف يدوياً
        } else if (event.error === 'network') {
            showError('مشكلة في الاتصال بالشبكة. تحقق من الإنترنت.');
        } else if (event.error === 'audio-capture') {
            showError('تعذر الوصول إلى الميكروفون. تأكد من عدم استخدامه بواسطة تطبيق آخر.');
        } else {
            showError('حدث خطأ: ' + event.error);
        }
    };

    // 🎯 هذا هو الإصلاح الأهم: إعادة التشغيل التلقائي على الجوال
    recognition.onend = () => {
        if (isRecording && restartAttempts < MAX_RESTART_ATTEMPTS) {
            restartAttempts++;
            // تأخير بسيط لمنع الحلقة اللانهائية السريعة
            setTimeout(() => {
                if (isRecording) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log('فشل إعادة التشغيل:', e);
                        // إذا فشل 3 مرات متتالية، أوقف
                        if (restartAttempts > 3) {
                            isRecording = false;
                            statusEl.textContent = '⚠️ توقف التسجيل. اضغط "بدء" مرة أخرى.';
                            statusEl.className = 'status-box error';
                            updateUI(false);
                        }
                    }
                }
            }, 100);
        } else if (isRecording) {
            isRecording = false;
            statusEl.textContent = '⏹️ تم إيقاف التسجيل';
            statusEl.className = 'status-box';
            updateUI(false);
        }
    };

    return true;
}

// ==========================================
// 6. بدء التسجيل المباشر (بدون getUserMedia مزدوج)
// ==========================================
async function startRecording() {
    if (whisperLoading) {
        showToast('⚠️ جارٍ معالجة ملف صوتي، يرجى الانتظار');
        return;
    }

    // 🎯 إذا كان هناك تسجيل قيد التشغيل، أوقفه أولاً
    if (isRecording) {
        stopRecording();
        await new Promise(r => setTimeout(r, 300));
    }

    try {
        // إنشاء كائن التعرف إذا لم يكن موجوداً
        if (!recognition) {
            if (!initSpeechRecognition()) return;
        }

        // تحديث اللغة
        recognition.lang = languageSelect.value;

        // 🎯 طلب صلاحية الميكروفون أولاً (مهم للجوال)
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                // طلب الصلاحية فقط، ثم إغلاق المسار فوراً
                const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                tempStream.getTracks().forEach(track => track.stop());
                // تأخير صغير للسماح للنظام بتحرير الميكروفون
                await new Promise(r => setTimeout(r, 200));
            } catch (permError) {
                console.warn('تعذر الحصول على صلاحية الميكروفون:', permError);
                showError('يجب السماح بالوصول إلى الميكروفون لتشغيل التسجيل.');
                return;
            }
        }

        isRecording = true;
        restartAttempts = 0;

        // 🎯 بدء التعرف مباشرة (بدون Web Audio)
        recognition.start();

        statusEl.textContent = '🔴 جارٍ التسجيل... تحدث الآن بوضوح';
        statusEl.className = 'status-box recording';
        updateUI(true);

    } catch (e) {
        console.error('خطأ في بدء التسجيل:', e);
        isRecording = false;
        showError('تعذر بدء التسجيل: ' + e.message);
        updateUI(false);
    }
}

// ==========================================
// 7. إيقاف التسجيل
// ==========================================
function stopRecording() {
    isRecording = false;
    restartAttempts = 0;

    if (recognition) {
        try { recognition.stop(); } catch (e) {}
    }

    updateUI(false);
    statusEl.textContent = '⏹️ تم إيقاف التسجيل';
    statusEl.className = 'status-box';
}

// ==========================================
// 8. تحديث الواجهة
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
// 9. عرض النص الكامل
// ==========================================
function showFullText() {
    modalText.textContent = finalTranscript.trim() || 'لا يوجد نص لعرضه';
    modal.classList.remove('hidden');
}

// ==========================================
// 10. نسخ النص
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
// 11. مسح النص
// ==========================================
function clearTranscript() {
    if (isRecording) return;

    finalTranscript = '';
    transcriptEl.textContent = 'سيظهر النص هنا...';
    interimEl.textContent = '';
    viewBtn.disabled = true;
    copyBtn.disabled = true;
    pdfBtn.disabled = true;
    clearBtn.disabled = true;

    const oldInfo = document.getElementById('currentFileInfo');
    if (oldInfo) oldInfo.remove();

    showToast('🗑️ تم مسح النص');
}

// ==========================================
// 12. تصدير PDF
// ==========================================
async function exportToPDF() {
    const text = finalTranscript.trim();
    if (!text) {
        showToast('⚠️ لا يوجد نص لتصديره');
        return;
    }

    pdfBtn.disabled = true;
    statusEl.textContent = '📥 جارٍ إنشاء ملف PDF...';
    statusEl.className = 'status-box processing';

    try {
        if (!window.html2pdf) {
            await loadScript(
                'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js'
            );
        }

        const pdfContainer = document.createElement('div');
        pdfContainer.dir = 'rtl';
        pdfContainer.style.cssText = `
            font-family: 'Segoe UI', Tahoma, sans-serif;
            direction: rtl;
            text-align: right;
            padding: 40px;
            color: #333;
            line-height: 1.9;
            font-size: 14pt;
            background: #fff;
        `;

        const today = new Date().toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        pdfContainer.innerHTML = `
            <div style="text-align: center; border-bottom: 3px solid #27ae60; padding-bottom: 15px; margin-bottom: 25px;">
                <h1 style="color: #1b5e20; font-size: 20pt; margin: 0 0 8px 0; font-weight: bold;">
                    🌾 جمعية حنطة الخيرية التنموية
                </h1>
                <p style="color: #4a7c59; font-size: 11pt; margin: 0;">
                    محوّل الكلام إلى نص — تفريغ المحاضرات والدروس
                </p>
                <p style="color: #888; font-size: 9pt; margin: 8px 0 0 0;">
                    تاريخ الإنشاء: ${today}
                </p>
            </div>
            <div style="white-space: pre-wrap; word-wrap: break-word; text-align: right; direction: rtl; min-height: 200px;">
                ${escapeHtml(text)}
            </div>
            <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 9pt;">
                © ${new Date().getFullYear()} جمعية حنطة الخيرية التنموية — جميع الحقوق محفوظة
            </div>
        `;

        const fileName = `محاضرة_${new Date().toISOString().slice(0, 10)}.pdf`;

        const options = {
            margin: [10, 10, 10, 10],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        await window.html2pdf().set(options).from(pdfContainer).save();

        statusEl.textContent = '✅ تم تصدير ملف PDF بنجاح';
        statusEl.className = 'status-box success';
        showToast('✅ تم تحميل ملف PDF');

    } catch (e) {
        console.error('خطأ في تصدير PDF:', e);
        showError('تعذر إنشاء ملف PDF: ' + e.message);
    } finally {
        pdfBtn.disabled = false;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error('فشل تحميل المكتبة: ' + src));
        document.head.appendChild(script);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
    showProgress('جارٍ تحميل نموذج التعرف (قد يستغرق دقيقة)...', 0);

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
                        showProgress(`جارٍ تحميل النموذج: ${data.file || ''}`, pct);
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

    const oldInfo = document.getElementById('currentFileInfo');
    if (oldInfo) oldInfo.remove();

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
            pdfBtn.disabled = false;
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
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
viewBtn.addEventListener('click', showFullText);
copyBtn.addEventListener('click', copyTranscript);
pdfBtn.addEventListener('click', exportToPDF);
clearBtn.addEventListener('click', clearTranscript);

closeModal.addEventListener('click', () => modal.classList.add('hidden'));
modalCloseBtn.addEventListener('click', () => modal.classList.add('hidden'));
modalCopyBtn.addEventListener('click', async () => {
    await copyTranscript();
    modal.classList.add('hidden');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
});

languageSelect.addEventListener('change', () => {
    if (recognition && !isRecording) {
        recognition.lang = languageSelect.value;
    }
});

// 🎯 شريط الحساسية أصبح للعرض فقط (لا يؤثر على التعرف الفعلي)
gainSlider.addEventListener('input', (e) => {
    currentGain = parseFloat(e.target.value);
    gainValue.textContent = currentGain + 'x';
});

sensitivityToggle.addEventListener('change', () => {
    if (sensitivityToggle.checked) {
        showToast('🔊 وضع التقاط الهمس مفعّل — اقترب من المتحدث');
    } else {
        showToast('🔉 وضع التقاط الهمس معطّل');
    }
});

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

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        processAudioFile(file);
    }
});

document.addEventListener('keydown', (e) => {
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
        showError('متصفحك لا يدعم التعرف المباشر على الكلام. استخدم Google Chrome على Android أو Safari على iPhone.');
    } else if (isMobile) {
        statusEl.textContent = '📱 أنت على الجوال — اضغط "بدء التسجيل" ووافق على صلاحية الميكروفون';
        statusEl.className = 'status-box';
    }

    const yearEl = document.getElementById('currentYear');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
});

window.addEventListener('beforeunload', () => {
    if (isRecording) stopRecording();
});
