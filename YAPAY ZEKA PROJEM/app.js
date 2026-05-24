/* ============================================
   LGS & YKS Puan Hesaplama - Application Logic
   ============================================ */

// ============ UTILITY FUNCTIONS ============

/**
 * Calculate net score: Doğru - (Yanlış / divisor)
 * LGS: divisor = 3, YKS: divisor = 4
 */
function calculateNet(dogru, yanlis, divisor) {
    return dogru - (yanlis / divisor);
}

/**
 * Get numeric value from input element
 */
function getVal(id) {
    const el = document.getElementById(id);
    return el ? (parseFloat(el.value) || 0) : 0;
}

/**
 * Validate input doesn't exceed max or go below 0
 * Also ensure doğru + yanlış doesn't exceed total questions
 */
function validateInput(input, maxQuestions) {
    let val = parseInt(input.value) || 0;
    if (val < 0) val = 0;
    if (val > maxQuestions) val = maxQuestions;
    input.value = val;

    // Check doğru + yanlış <= maxQuestions
    const id = input.id;
    const parts = id.split('-');
    const type = parts[parts.length - 1]; // 'dogru' or 'yanlis'
    const baseId = id.replace(/-dogru$|-yanlis$/, '');

    const dogruEl = document.getElementById(baseId + '-dogru');
    const yanlisEl = document.getElementById(baseId + '-yanlis');

    if (dogruEl && yanlisEl) {
        const dogru = parseInt(dogruEl.value) || 0;
        const yanlis = parseInt(yanlisEl.value) || 0;
        if (dogru + yanlis > maxQuestions) {
            if (type === 'dogru') {
                dogruEl.value = maxQuestions - yanlis;
            } else {
                yanlisEl.value = maxQuestions - dogru;
            }
        }
    }
}

/**
 * Validate and calculate for LGS
 */
function validateAndCalculateLGS(input, maxQuestions) {
    validateInput(input, maxQuestions);
    updateLGSNets();
}

/**
 * Validate and calculate for YKS
 */
function validateAndCalculateYKS(input, maxQuestions) {
    validateInput(input, maxQuestions);
    updateTYTNets();
}

/**
 * Adjust value with +/- buttons
 */
function adjustValue(inputId, delta, maxQuestions) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let val = (parseInt(input.value) || 0) + delta;
    if (val < 0) val = 0;
    if (val > maxQuestions) val = maxQuestions;
    input.value = val;

    // Re-validate total
    validateInput(input, maxQuestions);

    // Update nets based on which exam
    if (inputId.startsWith('lgs-')) {
        updateLGSNets();
    } else if (inputId.startsWith('tyt-')) {
        updateTYTNets();
    }
    // AYT nets update on calculate
}

/**
 * Animate a number counting up
 */
function animateValue(element, start, end, duration) {
    const startTime = performance.now();
    const diff = end - start;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = start + diff * eased;
        element.textContent = current.toFixed(2);
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/**
 * Create a breakdown bar HTML
 */
function createBreakdownBar(name, net, maxNet, color) {
    const percentage = maxNet > 0 ? Math.max(0, (net / maxNet) * 100) : 0;
    return `
        <div class="breakdown-item">
            <span class="subject-name">${name}</span>
            <div class="bar-track">
                <div class="bar-fill" style="width: ${percentage}%; background: ${color};"></div>
            </div>
            <span class="bar-value">${net.toFixed(2)}</span>
        </div>
    `;
}


// ============ HISTORICAL DATA & RANKING ============

/**
 * Son 5 Yıl LGS Verileri (Yaklaşık)
 * Kaynak: MEB açıklamaları ve istatistikler
 */
const LGS_YEARLY_DATA = {
    2021: { totalStudents: 1097000 },
    2022: { totalStudents: 1157000 },
    2023: { totalStudents: 1207000 },
    2024: { totalStudents: 1254000 },
    2025: { totalStudents: 1308000 }
};

/**
 * Son 5 Yıl YKS TYT Verileri (Yaklaşık)
 * Kaynak: ÖSYM istatistikleri
 */
const TYT_YEARLY_DATA = {
    2021: { totalStudents: 2442000 },
    2022: { totalStudents: 2534000 },
    2023: { totalStudents: 2617000 },
    2024: { totalStudents: 2795000 },
    2025: { totalStudents: 2891000 }
};

/**
 * Son 5 Yıl AYT Puan Türüne Göre Aday Sayıları (Yaklaşık)
 */
const AYT_YEARLY_DATA = {
    say: {
        2021: { totalStudents: 780000 },
        2022: { totalStudents: 810000 },
        2023: { totalStudents: 835000 },
        2024: { totalStudents: 870000 },
        2025: { totalStudents: 905000 }
    },
    ea: {
        2021: { totalStudents: 590000 },
        2022: { totalStudents: 615000 },
        2023: { totalStudents: 640000 },
        2024: { totalStudents: 670000 },
        2025: { totalStudents: 698000 }
    },
    soz: {
        2021: { totalStudents: 480000 },
        2022: { totalStudents: 505000 },
        2023: { totalStudents: 525000 },
        2024: { totalStudents: 550000 },
        2025: { totalStudents: 572000 }
    },
    dil: {
        2021: { totalStudents: 185000 },
        2022: { totalStudents: 195000 },
        2023: { totalStudents: 205000 },
        2024: { totalStudents: 215000 },
        2025: { totalStudents: 225000 }
    }
};

/**
 * Puan → Yüzdelik dilim (üstten) eşleme tabloları
 * Piecewise linear interpolation ile ara değerler hesaplanır
 * [puan, yüzdeFromTop] formatında - yüzdeFromTop = üstten yüzde kaçlık dilimdesin
 */
const LGS_SCORE_CURVE = [
    [500, 0.001], [495, 0.01], [490, 0.05], [485, 0.1],
    [480, 0.2],  [475, 0.35], [470, 0.5],  [465, 0.7],
    [460, 1.0],  [455, 1.3],  [450, 1.7],  [445, 2.2],
    [440, 2.8],  [435, 3.5],  [430, 4.3],  [425, 5.2],
    [420, 6.3],  [415, 7.5],  [410, 8.8],  [405, 10.2],
    [400, 12.0], [395, 13.8], [390, 15.8], [385, 18.0],
    [380, 20.5], [375, 23.0], [370, 25.8], [365, 28.8],
    [360, 32.0], [355, 35.0], [350, 38.5], [345, 42.0],
    [340, 45.5], [335, 49.0], [330, 52.5], [325, 56.0],
    [320, 59.5], [315, 63.0], [310, 66.0], [305, 69.0],
    [300, 72.0], [290, 77.0], [280, 81.5], [270, 85.5],
    [260, 89.0], [250, 92.0], [240, 94.5], [230, 96.5],
    [220, 98.0], [210, 99.2], [200, 100.0]
];

const TYT_SCORE_CURVE = [
    [500, 0.001], [490, 0.01], [480, 0.04], [470, 0.1],
    [460, 0.2],  [450, 0.4],  [440, 0.7],  [430, 1.1],
    [420, 1.7],  [410, 2.5],  [400, 3.5],  [390, 4.8],
    [380, 6.5],  [370, 8.5],  [360, 11.0], [350, 13.5],
    [340, 16.5], [330, 20.0], [320, 24.0], [310, 28.0],
    [300, 32.5], [290, 37.0], [280, 42.0], [270, 47.0],
    [260, 52.0], [250, 57.0], [240, 62.0], [230, 67.0],
    [220, 72.0], [210, 76.5], [200, 80.5], [190, 84.5],
    [180, 88.0], [170, 91.0], [160, 93.5], [150, 95.5],
    [140, 97.0], [130, 98.2], [120, 99.0], [110, 99.6],
    [100, 100.0]
];

const AYT_SCORE_CURVES = {
    say: [
        [500, 0.001], [490, 0.02], [480, 0.06], [470, 0.15],
        [460, 0.3],  [450, 0.6],  [440, 1.0],  [430, 1.6],
        [420, 2.5],  [410, 3.6],  [400, 5.0],  [390, 6.8],
        [380, 9.0],  [370, 11.5], [360, 14.5], [350, 17.5],
        [340, 21.0], [330, 25.0], [320, 29.5], [310, 34.0],
        [300, 39.0], [290, 44.0], [280, 49.0], [270, 54.0],
        [260, 59.0], [250, 64.0], [240, 69.0], [230, 74.0],
        [220, 78.5], [210, 83.0], [200, 87.0], [180, 92.0],
        [160, 95.5], [140, 98.0], [120, 99.3], [100, 100.0]
    ],
    ea: [
        [500, 0.001], [490, 0.02], [480, 0.05], [470, 0.12],
        [460, 0.25], [450, 0.5],  [440, 0.9],  [430, 1.5],
        [420, 2.3],  [410, 3.4],  [400, 4.8],  [390, 6.5],
        [380, 8.8],  [370, 11.5], [360, 14.5], [350, 18.0],
        [340, 22.0], [330, 26.5], [320, 31.0], [310, 36.0],
        [300, 41.0], [290, 46.5], [280, 52.0], [270, 57.0],
        [260, 62.5], [250, 68.0], [240, 73.0], [230, 78.0],
        [220, 82.5], [210, 87.0], [200, 90.5], [180, 94.5],
        [160, 97.0], [140, 98.8], [120, 99.5], [100, 100.0]
    ],
    soz: [
        [500, 0.001], [490, 0.02], [480, 0.06], [470, 0.14],
        [460, 0.28], [450, 0.55], [440, 1.0],  [430, 1.6],
        [420, 2.5],  [410, 3.8],  [400, 5.5],  [390, 7.5],
        [380, 10.0], [370, 13.0], [360, 16.5], [350, 20.0],
        [340, 24.5], [330, 29.0], [320, 34.0], [310, 39.0],
        [300, 44.0], [290, 49.5], [280, 55.0], [270, 60.0],
        [260, 65.0], [250, 70.0], [240, 75.0], [230, 80.0],
        [220, 84.5], [210, 88.5], [200, 92.0], [180, 95.5],
        [160, 97.5], [140, 99.0], [120, 99.6], [100, 100.0]
    ],
    dil: [
        [500, 0.001], [490, 0.03], [480, 0.08], [470, 0.2],
        [460, 0.4],  [450, 0.8],  [440, 1.3],  [430, 2.0],
        [420, 3.0],  [410, 4.5],  [400, 6.5],  [390, 9.0],
        [380, 12.0], [370, 15.5], [360, 19.5], [350, 24.0],
        [340, 29.0], [330, 34.0], [320, 39.5], [310, 45.0],
        [300, 50.5], [290, 56.0], [280, 61.5], [270, 67.0],
        [260, 72.0], [250, 77.0], [240, 81.5], [230, 85.5],
        [220, 89.0], [210, 92.0], [200, 94.5], [180, 97.0],
        [160, 98.5], [140, 99.3], [120, 99.7], [100, 100.0]
    ]
};

/**
 * Piecewise linear interpolation
 * curve: [[score, percentFromTop], ...] - score desc order
 */
function interpolatePercentile(score, curve) {
    // Score above max
    if (score >= curve[0][0]) return curve[0][1];
    // Score below min
    if (score <= curve[curve.length - 1][0]) return curve[curve.length - 1][1];

    for (let i = 0; i < curve.length - 1; i++) {
        const [s1, p1] = curve[i];
        const [s2, p2] = curve[i + 1];
        if (score <= s1 && score >= s2) {
            // Linear interpolation
            const t = (s1 - score) / (s1 - s2);
            return p1 + t * (p2 - p1);
        }
    }
    return 100;
}

/**
 * Format number with Turkish thousands separator (dot)
 */
function formatNumber(num) {
    return Math.round(num).toLocaleString('tr-TR');
}

/**
 * Get performance badge info based on percentile from top
 */
function getBadgeInfo(percentFromTop) {
    if (percentFromTop <= 1) return { text: '🥇 İlk %1 — Mükemmel!', cls: 'badge-excellent' };
    if (percentFromTop <= 5) return { text: '🌟 İlk %5 — Çok Başarılı', cls: 'badge-excellent' };
    if (percentFromTop <= 10) return { text: '✨ İlk %10 — Başarılı', cls: 'badge-great' };
    if (percentFromTop <= 25) return { text: '💪 İlk %25 — İyi', cls: 'badge-good' };
    if (percentFromTop <= 50) return { text: '📈 Üst Yarı — Ortalamanın Üstü', cls: 'badge-average' };
    if (percentFromTop <= 75) return { text: '📊 Orta Seviye', cls: 'badge-average' };
    return { text: '📚 Geliştirilmeli', cls: 'badge-below' };
}

/**
 * Get CSS class for percentile cell coloring
 */
function getPercentileColorClass(percentFromTop) {
    if (percentFromTop <= 10) return 'percentile-high';
    if (percentFromTop <= 35) return 'percentile-mid';
    if (percentFromTop <= 65) return 'percentile-low';
    return 'percentile-vlow';
}

/**
 * Update circular SVG gauge
 */
function updateGauge(gaugeId, percentFromTop) {
    const circumference = 2 * Math.PI * 52; // r=52
    const percentile = 100 - percentFromTop; // convert to "how good" percentage
    const dashLength = (percentile / 100) * circumference;

    const el = document.getElementById(gaugeId);
    if (el) {
        // Set initial state then animate
        el.style.transition = 'none';
        el.setAttribute('stroke-dasharray', `0 ${circumference}`);
        // Force reflow
        void el.offsetWidth;
        el.style.transition = 'stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)';
        el.setAttribute('stroke-dasharray', `${dashLength} ${circumference}`);

        // Dynamic color based on percentile
        if (percentFromTop <= 5) {
            el.style.stroke = '#10b981';
        } else if (percentFromTop <= 15) {
            el.style.stroke = '#3b82f6';
        } else if (percentFromTop <= 35) {
            el.style.stroke = '#6366f1';
        } else if (percentFromTop <= 60) {
            el.style.stroke = '#f59e0b';
        } else {
            el.style.stroke = '#f43f5e';
        }
    }
}

/**
 * Build yearly comparison table rows
 */
function buildYearlyTable(tbodyId, puan, yearlyData, scoreCurve) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const years = Object.keys(yearlyData).sort((a, b) => b - a);
    let html = '';

    years.forEach((year, idx) => {
        const data = yearlyData[year];
        const percentFromTop = interpolatePercentile(puan, scoreCurve);
        const ranking = Math.max(1, Math.round((percentFromTop / 100) * data.totalStudents));
        const percentile = (100 - percentFromTop).toFixed(1);
        const colorCls = getPercentileColorClass(percentFromTop);
        const isLatest = idx === 0;

        html += `
            <tr class="${isLatest ? 'highlight-row' : ''}">
                <td class="year-cell">${year}</td>
                <td>${formatNumber(data.totalStudents)}</td>
                <td>~${formatNumber(ranking)}</td>
                <td class="percentile-cell ${colorCls}">%${percentile}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

/**
 * Main function to display ranking for any exam type
 */
function displayRanking(prefix, puan, yearlyData, scoreCurve) {
    const percentFromTop = interpolatePercentile(puan, scoreCurve);
    const percentile = (100 - percentFromTop).toFixed(1);

    // Average student count across years
    const years = Object.values(yearlyData);
    const avgStudents = Math.round(years.reduce((sum, y) => sum + y.totalStudents, 0) / years.length);

    // Latest year ranking
    const latestYear = Math.max(...Object.keys(yearlyData).map(Number));
    const latestData = yearlyData[latestYear];
    const ranking = Math.max(1, Math.round((percentFromTop / 100) * latestData.totalStudents));

    // Update gauge
    updateGauge(prefix + '-gauge-fill', percentFromTop);

    // Update percentile text
    const percentileEl = document.getElementById(prefix + '-percentile');
    if (percentileEl) percentileEl.textContent = `%${percentile}`;

    // Update ranking number
    const siralamaEl = document.getElementById(prefix + '-siralama');
    if (siralamaEl) siralamaEl.textContent = `~${formatNumber(ranking)}`;

    // Update badge
    const badgeEl = document.getElementById(prefix + '-badge');
    if (badgeEl) {
        const badge = getBadgeInfo(percentFromTop);
        badgeEl.textContent = badge.text;
        badgeEl.className = 'ranking-badge ' + badge.cls;
    }

    // Update average students
    const avgEl = document.getElementById(prefix + '-avg-students');
    if (avgEl) avgEl.textContent = `~${formatNumber(avgStudents)}`;

    // Build yearly table
    buildYearlyTable(prefix + '-yearly-tbody', puan, yearlyData, scoreCurve);
}


// ============ TAB SWITCHING ============

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update tabs
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update sections
        const tabName = btn.dataset.tab;
        document.querySelectorAll('.exam-section').forEach(s => s.classList.remove('active'));
        document.getElementById('section-' + tabName).classList.add('active');
    });
});

document.querySelectorAll('.sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const subtab = btn.dataset.subtab;
        document.querySelectorAll('.sub-section').forEach(s => s.classList.remove('active'));
        document.getElementById('subsection-' + subtab).classList.add('active');
    });
});


// ============ AYT TYPE SWITCHING ============

function switchAYTType(type) {
    document.querySelectorAll('.ayt-type-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('ayt-type-' + type).classList.add('active');

    document.querySelectorAll('.ayt-fields').forEach(f => f.classList.remove('active'));
    document.getElementById('ayt-fields-' + type).classList.add('active');

    // Hide result when switching type
    document.getElementById('ayt-result').classList.add('hidden');
}


// ============ LGS CALCULATIONS ============

const LGS_SUBJECTS = [
    { key: 'turkce', name: 'Türkçe', maxQ: 20, color: '#6366f1' },
    { key: 'matematik', name: 'Matematik', maxQ: 20, color: '#f43f5e' },
    { key: 'fen', name: 'Fen Bilimleri', maxQ: 20, color: '#10b981' },
    { key: 'inkilap', name: 'İnkılap Tarihi', maxQ: 10, color: '#f59e0b' },
    { key: 'din', name: 'Din Kültürü', maxQ: 10, color: '#8b5cf6' },
    { key: 'dil', name: 'Yabancı Dil', maxQ: 10, color: '#06b6d4' }
];

function updateLGSNets() {
    LGS_SUBJECTS.forEach(sub => {
        const dogru = getVal('lgs-' + sub.key + '-dogru');
        const yanlis = getVal('lgs-' + sub.key + '-yanlis');
        const net = calculateNet(dogru, yanlis, 3);
        document.getElementById('lgs-' + sub.key + '-net').textContent = net.toFixed(2);
    });
}

function calculateLGS() {
    let totalNet = 0;
    let totalDogru = 0;
    let totalYanlis = 0;
    const netDetails = [];

    LGS_SUBJECTS.forEach(sub => {
        const dogru = getVal('lgs-' + sub.key + '-dogru');
        const yanlis = getVal('lgs-' + sub.key + '-yanlis');
        const net = calculateNet(dogru, yanlis, 3);

        totalNet += net;
        totalDogru += dogru;
        totalYanlis += yanlis;
        netDetails.push({ ...sub, net, dogru, yanlis });
    });

    const totalBos = 90 - totalDogru - totalYanlis;

    // LGS Puan Hesaplama (Yaklaşık)
    // Puan = 200 + (Toplam Net / 90) × 300
    let puan = 200 + (totalNet / 90) * 300;
    puan = Math.max(200, Math.min(500, puan));

    // Show result
    const resultPanel = document.getElementById('lgs-result');
    resultPanel.classList.remove('hidden');

    // Animate score
    const puanEl = document.getElementById('lgs-puan');
    puanEl.classList.remove('score-animate');
    void puanEl.offsetWidth; // trigger reflow
    puanEl.classList.add('score-animate');
    animateValue(puanEl, 0, puan, 800);

    // Update stats
    document.getElementById('lgs-toplam-net').textContent = totalNet.toFixed(2);
    document.getElementById('lgs-toplam-dogru').textContent = totalDogru;
    document.getElementById('lgs-toplam-yanlis').textContent = totalYanlis;
    document.getElementById('lgs-toplam-bos').textContent = totalBos;

    // Build breakdown bars
    const barsContainer = document.getElementById('lgs-breakdown-bars');
    barsContainer.innerHTML = netDetails.map(d =>
        createBreakdownBar(d.name, d.net, d.maxQ, d.color)
    ).join('');

    // Display ranking & percentile
    displayRanking('lgs', puan, LGS_YEARLY_DATA, LGS_SCORE_CURVE);

    // Smooth scroll to result
    setTimeout(() => {
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function resetLGS() {
    LGS_SUBJECTS.forEach(sub => {
        document.getElementById('lgs-' + sub.key + '-dogru').value = 0;
        document.getElementById('lgs-' + sub.key + '-yanlis').value = 0;
        document.getElementById('lgs-' + sub.key + '-net').textContent = '0.00';
    });
    document.getElementById('lgs-result').classList.add('hidden');
}


// ============ TYT CALCULATIONS ============

const TYT_SUBJECTS = [
    { key: 'turkce', name: 'Türkçe', maxQ: 40, color: '#6366f1' },
    { key: 'sosyal', name: 'Sosyal Bilimler', maxQ: 20, color: '#f59e0b' },
    { key: 'matematik', name: 'Temel Matematik', maxQ: 40, color: '#f43f5e' },
    { key: 'fen', name: 'Fen Bilimleri', maxQ: 20, color: '#10b981' }
];

function updateTYTNets() {
    TYT_SUBJECTS.forEach(sub => {
        const dogru = getVal('tyt-' + sub.key + '-dogru');
        const yanlis = getVal('tyt-' + sub.key + '-yanlis');
        const net = calculateNet(dogru, yanlis, 4);
        document.getElementById('tyt-' + sub.key + '-net').textContent = net.toFixed(2);
    });
}

function calculateTYT() {
    let totalNet = 0;
    let totalDogru = 0;
    let totalYanlis = 0;
    const netDetails = [];

    TYT_SUBJECTS.forEach(sub => {
        const dogru = getVal('tyt-' + sub.key + '-dogru');
        const yanlis = getVal('tyt-' + sub.key + '-yanlis');
        const net = calculateNet(dogru, yanlis, 4);

        totalNet += net;
        totalDogru += dogru;
        totalYanlis += yanlis;
        netDetails.push({ ...sub, net, dogru, yanlis });
    });

    const totalBos = 120 - totalDogru - totalYanlis;

    // TYT Puan = 100 + (Toplam Net × 3.334)
    let puan = 100 + (totalNet * 3.334);
    puan = Math.max(100, Math.min(500, puan));

    // Show result
    const resultPanel = document.getElementById('tyt-result');
    resultPanel.classList.remove('hidden');

    const puanEl = document.getElementById('tyt-puan');
    puanEl.classList.remove('score-animate');
    void puanEl.offsetWidth;
    puanEl.classList.add('score-animate');
    animateValue(puanEl, 0, puan, 800);

    document.getElementById('tyt-toplam-net').textContent = totalNet.toFixed(2);
    document.getElementById('tyt-toplam-dogru').textContent = totalDogru;
    document.getElementById('tyt-toplam-yanlis').textContent = totalYanlis;
    document.getElementById('tyt-toplam-bos').textContent = totalBos;

    // Breakdown bars
    const barsContainer = document.getElementById('tyt-breakdown-bars');
    barsContainer.innerHTML = netDetails.map(d =>
        createBreakdownBar(d.name, d.net, d.maxQ, d.color)
    ).join('');

    // Display ranking & percentile
    displayRanking('tyt', puan, TYT_YEARLY_DATA, TYT_SCORE_CURVE);

    setTimeout(() => {
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function resetTYT() {
    TYT_SUBJECTS.forEach(sub => {
        document.getElementById('tyt-' + sub.key + '-dogru').value = 0;
        document.getElementById('tyt-' + sub.key + '-yanlis').value = 0;
        document.getElementById('tyt-' + sub.key + '-net').textContent = '0.00';
    });
    document.getElementById('tyt-result').classList.add('hidden');
}


// ============ AYT CALCULATIONS ============

/*
 * AYT Puan Hesaplama (Yaklaşık Katsayılar)
 *
 * SAY Puanı = TYT Puanı × 0.40 + (Mat Net × 3.0 + Fiz Net × 2.85 + Kim Net × 3.07 + Bio Net × 3.07) + 100
 * EA Puanı  = TYT Puanı × 0.40 + (Mat Net × 3.0 + Edb Net × 3.33 + Tar1 Net × 2.80 + Coğ1 Net × 3.33) + 100
 * SÖZ Puanı = TYT Puanı × 0.40 + (Edb Net × 3.33 + Tar1 Net × 2.80 + Coğ1 Net × 3.33 + Tar2 × 2.91 + Coğ2 × 2.91 + Fel × 3.0 + Din × 3.33) + 100
 * DİL Puanı = TYT Puanı × 0.40 + (YDil Net × 3.125) + 100
 */

const AYT_CONFIG = {
    say: {
        label: 'SAY',
        fields: [
            { id: 'ayt-say-mat', name: 'Matematik', maxQ: 40, coef: 3.0, color: '#f43f5e' },
            { id: 'ayt-say-fiz', name: 'Fizik', maxQ: 14, coef: 2.85, color: '#8b5cf6' },
            { id: 'ayt-say-kim', name: 'Kimya', maxQ: 13, coef: 3.07, color: '#10b981' },
            { id: 'ayt-say-bio', name: 'Biyoloji', maxQ: 13, coef: 3.07, color: '#06b6d4' }
        ]
    },
    ea: {
        label: 'EA',
        fields: [
            { id: 'ayt-ea-mat', name: 'Matematik', maxQ: 40, coef: 3.0, color: '#f43f5e' },
            { id: 'ayt-ea-edb', name: 'Edebiyat', maxQ: 24, coef: 3.33, color: '#6366f1' },
            { id: 'ayt-ea-tar1', name: 'Tarih-1', maxQ: 10, coef: 2.80, color: '#f59e0b' },
            { id: 'ayt-ea-cog1', name: 'Coğrafya-1', maxQ: 6, coef: 3.33, color: '#10b981' }
        ]
    },
    soz: {
        label: 'SÖZ',
        fields: [
            { id: 'ayt-soz-edb', name: 'Edebiyat', maxQ: 24, coef: 3.33, color: '#6366f1' },
            { id: 'ayt-soz-tar1', name: 'Tarih-1', maxQ: 10, coef: 2.80, color: '#f59e0b' },
            { id: 'ayt-soz-cog1', name: 'Coğrafya-1', maxQ: 6, coef: 3.33, color: '#10b981' },
            { id: 'ayt-soz-tar2', name: 'Tarih-2', maxQ: 11, coef: 2.91, color: '#8b5cf6' },
            { id: 'ayt-soz-cog2', name: 'Coğrafya-2', maxQ: 11, coef: 2.91, color: '#06b6d4' },
            { id: 'ayt-soz-fel', name: 'Felsefe', maxQ: 12, coef: 3.0, color: '#f43f5e' },
            { id: 'ayt-soz-din', name: 'Din Kültürü', maxQ: 6, coef: 3.33, color: '#ec4899' }
        ]
    },
    dil: {
        label: 'DİL',
        fields: [
            { id: 'ayt-dil', name: 'Yabancı Dil', maxQ: 80, coef: 3.125, color: '#06b6d4' }
        ]
    }
};

function getActivePuanType() {
    const activeBtn = document.querySelector('.ayt-type-btn.active');
    return activeBtn ? activeBtn.dataset.type : 'say';
}

function getTYTPuan() {
    // Get TYT nets to calculate TYT contribution
    let tytNet = 0;
    TYT_SUBJECTS.forEach(sub => {
        const dogru = getVal('tyt-' + sub.key + '-dogru');
        const yanlis = getVal('tyt-' + sub.key + '-yanlis');
        tytNet += calculateNet(dogru, yanlis, 4);
    });
    let tytPuan = 100 + (tytNet * 3.334);
    return Math.max(100, Math.min(500, tytPuan));
}

function calculateAYT() {
    const type = getActivePuanType();
    const config = AYT_CONFIG[type];

    let aytWeightedScore = 0;
    let totalDogru = 0;
    let totalYanlis = 0;
    let totalNet = 0;
    const netDetails = [];

    config.fields.forEach(field => {
        const dogru = getVal(field.id + '-dogru');
        const yanlis = getVal(field.id + '-yanlis');
        const net = calculateNet(dogru, yanlis, 4);

        // Update net display
        const netEl = document.getElementById(field.id + '-net');
        if (netEl) netEl.textContent = net.toFixed(2);

        aytWeightedScore += net * field.coef;
        totalDogru += dogru;
        totalYanlis += yanlis;
        totalNet += net;
        netDetails.push({ ...field, net });
    });

    // Get TYT contribution
    const tytPuan = getTYTPuan();
    const tytContribution = tytPuan * 0.40;

    // Final score
    let puan = tytContribution + aytWeightedScore + 100;
    puan = Math.max(100, Math.min(500, puan));

    // Show result
    const resultPanel = document.getElementById('ayt-result');
    resultPanel.classList.remove('hidden');

    // Update label
    document.getElementById('ayt-puan-label').textContent = `Tahmini ${config.label} Puanı`;

    const puanEl = document.getElementById('ayt-puan');
    puanEl.classList.remove('score-animate');
    void puanEl.offsetWidth;
    puanEl.classList.add('score-animate');
    animateValue(puanEl, 0, puan, 800);

    document.getElementById('ayt-toplam-net').textContent = totalNet.toFixed(2);
    document.getElementById('ayt-toplam-dogru').textContent = totalDogru;
    document.getElementById('ayt-toplam-yanlis').textContent = totalYanlis;

    // Breakdown
    const barsContainer = document.getElementById('ayt-breakdown-bars');
    barsContainer.innerHTML = netDetails.map(d =>
        createBreakdownBar(d.name, d.net, d.maxQ, d.color)
    ).join('');

    // Display ranking & percentile for AYT
    const aytYearlyData = AYT_YEARLY_DATA[type];
    const aytScoreCurve = AYT_SCORE_CURVES[type];
    displayRanking('ayt', puan, aytYearlyData, aytScoreCurve);

    setTimeout(() => {
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

function resetAYT() {
    const type = getActivePuanType();
    const config = AYT_CONFIG[type];

    config.fields.forEach(field => {
        const dogruEl = document.getElementById(field.id + '-dogru');
        const yanlisEl = document.getElementById(field.id + '-yanlis');
        const netEl = document.getElementById(field.id + '-net');
        if (dogruEl) dogruEl.value = 0;
        if (yanlisEl) yanlisEl.value = 0;
        if (netEl) netEl.textContent = '0.00';
    });

    document.getElementById('ayt-result').classList.add('hidden');
}


// ============ KEYBOARD SUPPORT ============

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        // Determine which section is active and calculate
        const lgsSection = document.getElementById('section-lgs');
        if (lgsSection.classList.contains('active')) {
            calculateLGS();
        } else {
            const tytSub = document.getElementById('subsection-tyt');
            if (tytSub.classList.contains('active')) {
                calculateTYT();
            } else {
                calculateAYT();
            }
        }
    }
});


// ============ INITIAL STATE ============

// Initialize nets
updateLGSNets();
updateTYTNets();

// Add stagger animation to cards on load
document.querySelectorAll('.subject-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
        card.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 100 + index * 80);
});
