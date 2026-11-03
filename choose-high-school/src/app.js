    // [데이터 영역] -> data.js 로 분리됨
    const allData = [];
    const years = [2023, 2024, 2025, 2026];
    const achievementSubjects = ['수학', '국어', '영어', '사회', '과학'];
    const achievementGrades = ['1학년', '2학년', '3학년'];
    const achievementYears = [2023, 2024, 2025];
    let selectedAchievementYear = 2024;
    let selectedAchievementGrade = '1학년';
    let selectedAchievementSubject = '수학';
    let achievementChartInstance = null;
    let selectedRankMetric = 'avg';
    let compareChartInstances = [];
    let selectedCompareMetric = 'avg';
    let selectedCompareSchools = ['낙생고', '서현고'];
    let compareViewMode = 'combined';
    let currentDataYear = 2026;
    let scatterChartInstance = null;
    let scatterChartInstance2 = null;
    let currentTab = 'quick-find';

    // 의학/주요대학/배정 화면용 상태
    let medCurrentTab = 'all';
    let medSortMode = '2026';
    let univCurrentYear = '2025';
    let univSortMode = '서울대';
    let assignSortMode = 'name';

    // baseStats를 기반으로 allData 생성
    years.forEach(year => {
        schoolNames.forEach(name => {
            const base = baseStats[name];
            let varianceAvg = 0, varianceStd = 0;
            let featureText = base.feature;
            if (year !== 2025) {
                varianceAvg = (Math.random() * 4 - 2);
                varianceStd = (Math.random() * 2 - 1);
            }
            if (year === 2026) featureText = base.feature + ' (26년 예상 트렌드)';
            else if (year < 2025) featureText = base.feature + ` (${year}년 분석 실제)`;
            else if (year === 2025) featureText = base.feature + ' (25년 1학기 지표)';
            allData.push({
                year, name,
                avg: parseFloat((base.avg + varianceAvg).toFixed(1)),
                stdDev: parseFloat((base.stdDev + varianceStd).toFixed(1)),
                diff: base.diff, feature: featureText, comment: base.comment
            });
        });
    });

    // 분당 평균 (v3.4)
    const BUNDANG_AVG = (() => {
        const subjs = ['국어', '영어', '수학', '사회', '과학'];
        const totals = { 국어: [], 영어: [], 수학: [], 사회: [], 과학: [] };
        Object.values(SCHOOL_DATA).forEach(d => {
            if (!d.subjects) return;
            subjs.forEach(s => totals[s].push(d.subjects[s].avg));
        });
        const result = {};
        subjs.forEach(s => { result[s] = totals[s].reduce((a, b) => a + b, 0) / totals[s].length; });
        return result;
    })();
    const REGION_LABEL = { all: '분당 전 지역', central: '분당 중앙', east: '분당 동부', west: '분당 서부', south: '분당 남부' };
    const STRONG_PROFILE = {
        math: { strong: ['수학', '과학'], weak: ['국어', '영어'], label: '수학·과학 강세' },
        kor:  { strong: ['국어', '영어'], weak: ['수학', '과학'], label: '국어·영어 강세' },
        bal:  { strong: [], weak: [], label: '균형형' }
    };

    Chart.defaults.color = '#64748b';
    Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.05)';
    Chart.defaults.font.family = "'Pretendard', 'Malgun Gothic', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 12;
    Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: 'bold' };
    Chart.defaults.scale.grid.color = 'rgba(0, 0, 0, 0.05)';
    Chart.defaults.scale.grid.drawTicks = false;
    Chart.defaults.scale.border.display = false;

    // =================================================================
    // [메뉴/탭 전환]
    // =================================================================
    function switchTab(tabId) {
        currentTab = tabId;
        document.querySelectorAll('.submenu-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        const views = ['quick-find', 'precise-recommend', 'math-deep', 'naesin-difficulty', 'subject-compare', 'medical-result', 'major-univ-result', 'assign-result'];
        views.forEach(v => {
            const el = document.getElementById('view-' + v);
            if (!el) return;
            if (v === tabId) {
                el.classList.remove('hidden');
                void el.offsetWidth;
                el.classList.add('animate-fade-in');
            } else {
                el.classList.add('hidden');
            }
        });

        const yearSection = document.getElementById('year-filter-section');
        if (tabId === 'math-deep') yearSection.classList.remove('hidden');
        else yearSection.classList.add('hidden');

        if (tabId === 'math-deep') {
            updateDataYear(currentDataYear);
            populateAnalysisCards();
        } else if (tabId === 'naesin-difficulty') {
            initAchievementDashboard();
        } else if (tabId === 'subject-compare') {
            selectedAchievementYear = subjCompareYear;
            selectedAchievementGrade = subjCompareGrade;
            createCompareSchoolBadges();
            renderCompareRadarChart();
        } else if (tabId === 'medical-result') {
            renderMedView();
        } else if (tabId === 'major-univ-result') {
            renderUnivView();
        } else if (tabId === 'assign-result') {
            renderAssignTable();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }


    // =================================================================
    // [v2.2 그대로 가져온 함수들]
    // =================================================================

    function setAchievementYear(year) {
        selectedAchievementYear = year;
        achievementYears.forEach(value => {
            const btn = document.getElementById(`ach-year-${value}`);
            if (btn) btn.className = value === year
                ? 'ach-year-btn px-5 py-2.5 text-sm font-black rounded-full border border-primary/20 bg-primary text-white transition-all shadow-md shadow-primary/20'
                : 'ach-year-btn px-5 py-2.5 text-sm font-bold rounded-full border border-slate-200 bg-white text-slate-500 hover:text-primary transition-all';
        });
        // 2025년부터 표준편차 미공개 → std 정렬 버튼 비활성화, std 정렬 중이었으면 평균으로 fallback
        const stdBtn = document.getElementById('rankBtn-std');
        if (stdBtn) {
            if (year >= 2025) {
                stdBtn.disabled = true;
                stdBtn.title = '2025학년도부터 학교알리미 표준편차 미공개';
                stdBtn.classList.add('opacity-40', 'cursor-not-allowed');
                if (selectedRankMetric === 'std') {
                    setRankMetric('avg');
                    return; // setRankMetric이 renderAchievementDashboard를 호출하므로
                }
            } else {
                stdBtn.disabled = false;
                stdBtn.title = '';
                stdBtn.classList.remove('opacity-40', 'cursor-not-allowed');
            }
        }
        renderAchievementDashboard();
    }
    function setAchievementGrade(grade) {
        selectedAchievementGrade = grade;
        achievementGrades.forEach(value => {
            const btn = document.getElementById(`ach-grade-${value}`);
            if (btn) btn.className = value === grade
                ? 'ach-grade-btn px-5 py-2.5 text-sm font-black rounded-full border border-primary/20 bg-primary text-white transition-all shadow-md shadow-primary/20'
                : 'ach-grade-btn px-5 py-2.5 text-sm font-bold rounded-full border border-slate-200 bg-white text-slate-500 hover:text-primary transition-all';
        });
        renderAchievementDashboard();
    }
    function setAchievementSubject(subject) {
        selectedAchievementSubject = subject;
        const select = document.getElementById('achievementSubject');
        if (select) select.value = subject;
        renderAchievementDashboard();
    }
    function setRankMetric(metric) {
        selectedRankMetric = metric;
        ['avg', 'std', 'gradeA'].forEach(m => {
            const btn = document.getElementById('rankBtn-' + m);
            if (!btn) return;
            if (m === metric) btn.className = 'rank-metric-btn px-4 py-1.5 text-[11px] font-black rounded-full border border-primary/20 bg-primary text-white transition-all shadow-md shadow-primary/20';
            else btn.className = 'rank-metric-btn px-4 py-1.5 text-[11px] font-black rounded-full border border-slate-200 bg-slate-50 text-slate-500 hover:text-primary transition-all';
        });
        renderAchievementDashboard();
    }

    function getAchievementDataset() {
        const data = (achievementData[selectedAchievementYear] || {})[selectedAchievementGrade] || [];
        return [...data].sort((a, b) => {
            const subj = selectedAchievementSubject;
            let aVal, bVal;
            if (selectedRankMetric === 'avg') { aVal = a[subj]?.avg ?? null; bVal = b[subj]?.avg ?? null; }
            else if (selectedRankMetric === 'std') { aVal = a[subj]?.std ?? null; bVal = b[subj]?.std ?? null; }
            else if (selectedRankMetric === 'gradeA') { aVal = a[subj]?.A ?? null; bVal = b[subj]?.A ?? null; }
            if (aVal === null && bVal === null) return 0;
            if (aVal === null) return 1;
            if (bVal === null) return -1;
            return bVal - aVal;
        });
    }

    function renderAchievementDashboard() {
        const dataset = getAchievementDataset();
        const validData = dataset.filter(item => item[selectedAchievementSubject]?.avg != null);
        const labels = validData.map(item => item.name);
        const stds = validData.map(item => item[selectedAchievementSubject].std);
        const values = validData.map(item => {
            const s = item[selectedAchievementSubject];
            if (selectedRankMetric === 'std') return s.std;
            if (selectedRankMetric === 'gradeA') return s.A;
            return s.avg;
        });

        const summaryEl = document.getElementById('achievementSummaryLabel');
        if (summaryEl) summaryEl.textContent = `${selectedAchievementYear}년 ${selectedAchievementGrade} ${selectedAchievementSubject} 성취도`;

        renderAchievementRankChart(labels, values, stds);
        renderAchievementTable(dataset);
        createCompareSchoolBadges();
        renderCompareRadarChart();
    }

    const radarColorPalette = [
        'rgba(99, 102, 241, %A)','rgba(244, 63, 94, %A)','rgba(34, 197, 94, %A)',
        'rgba(234, 179, 8, %A)','rgba(168, 85, 247, %A)','rgba(14, 165, 233, %A)'
    ];

    function createCompareSchoolBadges() {
        const container = document.getElementById('compareSchoolBadges');
        if (!container) return;
        container.innerHTML = '';
        schoolNames.forEach(school => {
            const isSelected = selectedCompareSchools.includes(school);
            const btn = document.createElement('button');
            btn.className = isSelected
                ? 'px-3.5 py-1.5 text-[11px] font-black rounded-full border transition-all text-white bg-primary border-primary shadow-md shadow-primary/20'
                : 'px-3.5 py-1.5 text-[11px] font-bold rounded-full border transition-all border-slate-200 bg-white text-slate-500 hover:border-primary hover:text-primary';
            btn.textContent = school;
            btn.onclick = () => toggleCompareSchool(school);
            container.appendChild(btn);
        });
    }
    function toggleCompareSchool(school) {
        const idx = selectedCompareSchools.indexOf(school);
        if (idx > -1) selectedCompareSchools.splice(idx, 1);
        else selectedCompareSchools.push(school);
        createCompareSchoolBadges();
        renderCompareRadarChart();
    }
    function setCompareMetric(metric) {
        selectedCompareMetric = metric;
        ['avg','std','gradeA'].forEach(m => {
            const btn = document.getElementById('compBtn-' + m);
            if (!btn) return;
            if (m === metric) btn.className = 'px-4 py-2 text-[11px] font-black rounded-xl border border-primary/20 bg-primary text-white transition-all shadow-md shadow-primary/10';
            else btn.className = 'px-4 py-2 text-[11px] font-black rounded-xl border border-transparent bg-transparent text-slate-500 hover:bg-white hover:text-primary transition-all';
        });
        renderCompareRadarChart();
    }
    function setCompareViewMode(mode) {
        compareViewMode = mode;
        ['combined','separate'].forEach(m => {
            const btn = document.getElementById('viewModeBtn-' + m);
            if (!btn) return;
            if (m === mode) btn.className = 'px-4 py-2 text-[11px] font-black rounded-xl border border-primary/20 bg-primary text-white transition-all shadow-md shadow-primary/10';
            else btn.className = 'px-4 py-2 text-[11px] font-black rounded-xl border border-transparent bg-transparent text-slate-500 hover:bg-white hover:text-primary transition-all';
        });
        renderCompareRadarChart();
    }

    function getCommonRadarOptions(metricMax) {
        return {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#64748b', padding: 10, font: { size: 12, family: 'Pretendard, sans-serif' }, usePointStyle: true } },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.95)', titleColor: '#fff', bodyColor: '#e2e8f0', borderColor: '#334155', borderWidth: 1, padding: 12,
                    callbacks: {
                        label: (ctx) => {
                            let unit = selectedCompareMetric === 'std' ? '' : (selectedCompareMetric === 'gradeA' ? '%' : '점');
                            let labelText = selectedCompareMetric === 'std' ? '표준편차' : (selectedCompareMetric === 'gradeA' ? 'A등급' : '평균');
                            return `${ctx.dataset.label} ${labelText}: ${ctx.raw ?? '미공시'}${ctx.raw ? unit : ''}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(0, 0, 0, 0.08)' },
                    grid: { color: 'rgba(0, 0, 0, 0.08)' },
                    pointLabels: { color: '#475569', font: { size: 12, family: 'Pretendard, sans-serif', weight: 'bold' } },
                    ticks: { backdropColor: 'transparent', color: '#94a3b8', stepSize: metricMax > 30 ? 20 : (metricMax === 30 ? 10 : 20), max: metricMax, min: 0 }
                }
            }
        };
    }

    function renderCompareRadarChart() {
        const container = document.getElementById('radarChartsContainer');
        if (!container) return;
        compareChartInstances.forEach(chart => chart.destroy());
        compareChartInstances = [];
        container.innerHTML = '';

        if (selectedCompareSchools.length === 0) {
            container.innerHTML = '<p class="text-textMuted text-sm m-auto">비교할 학교를 우측에서 선택해주세요.</p>';
            return;
        }

        const subjects = ['국어', '수학', '영어', '사회', '과학'];
        const allSchoolsData = achievementData[selectedAchievementYear]?.[selectedAchievementGrade] || [];

        let metricMax = 100;
        if (selectedCompareMetric === 'std') metricMax = 30;
        if (selectedCompareMetric === 'gradeA') metricMax = 100;
        const commonOptions = getCommonRadarOptions(metricMax);

        if (compareViewMode === 'combined') {
            const wrapper = document.createElement('div');
            wrapper.className = 'w-full h-full relative';
            wrapper.style.minHeight = '350px';
            const canvas = document.createElement('canvas');
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);

            const radarData = { labels: subjects, datasets: [] };
            selectedCompareSchools.forEach((school, index) => {
                const schoolData = allSchoolsData.find(d => d.name === school);
                const dataPoints = subjects.map(subj => {
                    if (!schoolData || !schoolData[subj]) return null;
                    const sd = schoolData[subj];
                    if (selectedCompareMetric === 'std') return sd.std;
                    if (selectedCompareMetric === 'gradeA') return sd.A;
                    return sd.avg;
                });
                const color = radarColorPalette[index % radarColorPalette.length];
                radarData.datasets.push({
                    label: school, data: dataPoints,
                    backgroundColor: color.replace('%A', '0.2'),
                    borderColor: color.replace('%A', '0.8'),
                    pointBackgroundColor: color.replace('%A', '1'),
                    pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: color.replace('%A', '1'),
                    borderWidth: 2, fill: true
                });
            });
            const chart = new Chart(canvas, { type: 'radar', data: radarData, options: commonOptions });
            compareChartInstances.push(chart);
        } else {
            const len = selectedCompareSchools.length;
            let gridClass = 'w-full';
            if (len === 2) gridClass = 'w-full sm:w-[calc(50%-1rem)]';
            if (len >= 3) gridClass = 'w-full sm:w-[calc(50%-1rem)] md:w-[calc(33.33%-1rem)]';

            selectedCompareSchools.forEach((school, index) => {
                const wrapper = document.createElement('div');
                wrapper.className = `${gridClass} flex flex-col justify-center items-center bg-slate-50 rounded-xl p-3 border border-slate-100 shadow-inner`;
                wrapper.style.minHeight = '280px';
                const label = document.createElement('div');
                label.className = 'text-slate-700 font-bold text-sm mb-2';
                label.textContent = school;
                wrapper.appendChild(label);
                const canvasWrapper = document.createElement('div');
                canvasWrapper.className = 'w-full flex-1 relative';
                const canvas = document.createElement('canvas');
                canvasWrapper.appendChild(canvas);
                wrapper.appendChild(canvasWrapper);
                container.appendChild(wrapper);

                const schoolData = allSchoolsData.find(d => d.name === school);
                const dataPoints = subjects.map(subj => {
                    if (!schoolData || !schoolData[subj]) return null;
                    const sd = schoolData[subj];
                    if (selectedCompareMetric === 'std') return sd.std;
                    if (selectedCompareMetric === 'gradeA') return sd.A;
                    return sd.avg;
                });
                const color = radarColorPalette[index % radarColorPalette.length];
                const radarData = { labels: subjects, datasets: [{
                    label: school, data: dataPoints,
                    backgroundColor: color.replace('%A', '0.25'),
                    borderColor: color.replace('%A', '0.9'),
                    pointBackgroundColor: color.replace('%A', '1'),
                    pointBorderColor: '#fff', pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: color.replace('%A', '1'),
                    borderWidth: 2, fill: true
                }]};
                const opt = getCommonRadarOptions(metricMax);
                opt.plugins.legend.display = false;
                opt.scales.r.pointLabels.font.size = 10;
                const chart = new Chart(canvas, { type: 'radar', data: radarData, options: opt });
                compareChartInstances.push(chart);
            });
        }
    }

    function renderAchievementRankChart(labels, values, stds) {
        const container = document.getElementById('achievementChartContainer');
        if (container) container.style.height = Math.max(320, labels.length * 42) + 'px';
        const ctx = document.getElementById('achievementRankChart').getContext('2d');
        if (achievementChartInstance) achievementChartInstance.destroy();

        const rankColor = (i) => i === 0 ? '#f59e0b' : i === 1 ? '#a78bfa' : i === 2 ? '#34d399' : '#6366f1';
        const metricConfig = {
            avg: { label: '평균 점수', unit: '점', xLabel: `${selectedAchievementSubject} 평균 점수`, xMin: 40, color: rankColor },
            std: { label: '표준편차', unit: '', xLabel: `${selectedAchievementSubject} 표준편차`, xMin: 0, color: rankColor },
            gradeA: { label: 'A등급 비율', unit: '%', xLabel: `${selectedAchievementSubject} A등급(%)`, xMin: 0, color: rankColor },
        };
        const mc = metricConfig[selectedRankMetric];

        const datasets = [{
            label: mc.label, data: values,
            backgroundColor: labels.map((_, i) => mc.color(i)),
            borderRadius: 10, barThickness: 16, borderSkipped: false, order: 1,
        }];
        if (selectedRankMetric === 'avg') {
            datasets.push({
                label: '표준편차', data: stds,
                backgroundColor: 'rgba(251,191,36,0.25)', borderColor: 'rgba(251,191,36,0.7)',
                borderWidth: 1, borderRadius: 6, barThickness: 8, borderSkipped: false, order: 2,
            });
        }

        achievementChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.datasetIndex === 1) return `표준편차: ${ctx.parsed.x}`;
                                return `${mc.label}: ${ctx.parsed.x}${mc.unit}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: mc.xLabel, color: '#64748b', font: { weight: 'bold' } }, grid: { color: 'rgba(0, 0, 0, 0.05)', borderDash: [4, 4] }, ticks: { color: '#94a3b8' }, min: mc.xMin },
                    y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
        function generateAchievementComment(item, subject, allData) {
            const sd = item[subject];
            const score = sd ? sd.avg : null;
            const stdVal = sd ? sd.std : null;
            const gradeAVal = (sd && sd.A !== undefined) ? sd.A : null;
            const name = item.name;
            if (score === null || score === undefined) return `${selectedAchievementYear}년 ${selectedAchievementGrade} ${name} ${subject} 데이터 미공시`;

            const s = {};
            ['국어', '수학', '영어', '사회', '과학'].forEach(subj => { s[subj] = item[subj]?.avg ?? null; });
            const info = baseStats[name] || {};

            // avg rank
            const valid = allData.filter(d => d[subject]?.avg !== null && d[subject]?.avg !== undefined);
            const sorted = [...valid].sort((a, b) => b[subject].avg - a[subject].avg);
            const rank = sorted.findIndex(d => d.name === name) + 1;
            const total = valid.length;
            const topQ = rank <= Math.ceil(total * 0.25);
            const botQ = rank > Math.ceil(total * 0.75);

            // std rank (higher std = rank 1)
            const validStd = allData.filter(d => d[subject]?.std !== null && d[subject]?.std !== undefined);
            const sortedStd = [...validStd].sort((a, b) => b[subject].std - a[subject].std);
            const stdRank = validStd.length > 0 ? sortedStd.findIndex(d => d.name === name) + 1 : null;
            const totalStd = validStd.length;

            // gradeA rank (higher A% = rank 1)
            const validA = allData.filter(d => d[subject]?.A !== null && d[subject]?.A !== undefined);
            const sortedA = [...validA].sort((a, b) => b[subject].A - a[subject].A);
            const aRank = validA.length > 0 ? sortedA.findIndex(d => d.name === name) + 1 : null;
            const totalA = validA.length;

            // Score tier (avg-based)
            const tier = score >= 75 ? 'A' : score >= 67 ? 'B' : score >= 57 ? 'C' : 'D';

            if (subject === '수학') {

                // ───── 평균 기준 분석 ─────
                if (selectedRankMetric === 'avg') {
                    let avgLevelMsg = '';
                    if (rank <= Math.ceil(total * 0.25)) {
                        // High Avg -> Easy Exam
                        if (aRank <= Math.ceil(totalA * 0.25)) {
                            avgLevelMsg = `평균 점수 ${score}점(전체 ${total}개교 중 ${rank}위)으로 분당 지역에서 수학 시험이 가장 평이하게 출제된 그룹에 속합니다. 킬러 문항이 적어 다수의 학생이 고득점을 달성(A등급 비율 상위권)했으며, 이로 인해 한 번의 실수가 등급 하락에 치명적인 영향을 미치는 극심한 눈치 싸움 환경입니다. 고도의 꼼꼼함이 내신을 가르는 핵심입니다.`;
                        } else if (aRank >= Math.ceil(totalA * 0.75)) {
                            avgLevelMsg = `평균 점수 ${score}점(전체 ${total}개교 중 ${rank}위)으로 전반적인 난이도는 낮으나, A등급 비율이 상대적으로 낮습니다. 이는 기본 문항은 매우 평이해 중하위권도 점수를 얻기 쉬웠으나, 상위권을 가르는 확실한 킬러 문항이 소수 존재하여 최상위권 진입 장벽이 뚜렷함을 의미합니다.`;
                        } else {
                            avgLevelMsg = `평균 점수 ${score}점(전체 ${total}개교 중 ${rank}위)으로 지역 내에서 수학 시험이 평이하게 출제된 편입니다. 기본 문항 비중이 높아 수학에 대한 심리적 부담은 적지만, 상위권 진입을 위해서는 실수를 최소화하고 서술형 감점을 철저히 방지하는 무결점 학습이 필요합니다.`;
                        }
                    } else if (rank <= Math.ceil(total * 0.75)) {
                        avgLevelMsg = `평균 점수 ${score}점(전체 ${total}개교 중 ${rank}위)으로 지역 내 평균 수준의 밸런스 있는 난이도를 보여줍니다. 평이한 문항과 변별력 있는 문항이 고루 섞여 있어, 본인의 학습량에 비례하여 안정적으로 성적을 확보할 수 있는 정직한 경쟁 환경입니다. 기출 변형 문제 대비와 실전 시간 안배가 등급 상승의 열쇠입니다.`;
                    } else {
                        // Low Avg -> Hard Exam
                        if (aRank <= Math.ceil(totalA * 0.25)) {
                            avgLevelMsg = `평균 점수 ${score}점(전체 ${total}개교 중 ${rank}위)으로 시험 자체는 극도로 어려웠음에도 불구하고 최상위권 학생층이 두텁게 형성(A등급 비율 상위권)되어 있습니다. 심화 문항을 소화하는 소수와 그렇지 못한 다수 간의 실력 격차가 극명한 치열한 양극화 환경입니다.`;
                        } else {
                            avgLevelMsg = `평균 점수 ${score}점(전체 ${total}개교 중 ${rank}위)으로 분당 지역에서 수학 시험이 가장 까다롭게 출제된 최상위 난이도 그룹입니다. 극단적인 고난도 문항이나 방대한 계산량으로 전체 평균이 크게 낮아졌으며, 단순 암기식 문제 풀이로는 한계가 명확합니다. 깊이 있는 수학적 사고력과 고난도 유형에 대한 도전적인 심화 학습만이 돌파구입니다.`;
                        }
                    }
                    const featureText = info.feature ? `전반적으로 [${info.feature}]라는 출제 특징을 보입니다. ` : '';
                    return `${name}의 수학 내신은 ${featureText}이번 지표 분석 결과, ` + avgLevelMsg;
                }

                // ───── 표준편차 기준 분석 ─────
                if (selectedRankMetric === 'std') {
                    if (stdVal === null || stdVal === undefined) return `${name} 수학 표준편차 데이터 미공시`;
                    let stdLevelMsg = '';
                    if (stdRank <= Math.ceil(totalStd * 0.25)) {
                        // High Std -> Polarized
                        if (rank <= Math.ceil(total * 0.25)) {
                            stdLevelMsg = `표준편차 ${stdVal}(전체 ${totalStd}개교 중 격차 ${stdRank}위)로 매우 큽니다. 평균 점수도 높아 전반적인 시험 자체는 평이했으나, 상위권과 중하위권 간의 성적 양극화가 뚜렷하게 발생했습니다. 고난도 문항보다는 실수를 줄이는 훈련이 상위권 경쟁의 핵심 변수입니다.`;
                        } else if (rank >= Math.ceil(total * 0.75)) {
                            stdLevelMsg = `표준편차 ${stdVal}(전체 ${totalStd}개교 중 격차 ${stdRank}위)로 양극화가 심합니다. 평균이 매우 낮게 형성될 만큼 까다로운 시험 속에서도 일부 최상위권 학생들이 굳건히 고득점을 유지해 격차가 크게 벌어졌습니다. 어려운 문항을 풀어내는 심화 사고력이 최상위권의 전제 조건입니다.`;
                        } else {
                            stdLevelMsg = `표준편차 ${stdVal}(전체 ${totalStd}개교 중 격차 ${stdRank}위)로 지역 내에서 상위권과 중하위권 학생 간의 점수 격차가 매우 큰 편입니다. 변별력을 확보하는 몇몇 고난도 문항이 이러한 양극화 구조를 만들어내며, 자신이 풀 수 있는 문항과 포기할 문항을 선별하는 전략이 등급 방어에 중요할 수 있습니다.`;
                        }
                    } else if (stdRank <= Math.ceil(totalStd * 0.75)) {
                        stdLevelMsg = `표준편차 ${stdVal}(전체 ${totalStd}개교 중 격차 ${stdRank}위)로 분당 지역 평균 수준의 점수 분포를 보입니다. 양극화나 밀집 현상이 두드러지지 않는 일반적인 경쟁 환경으로, 꾸준한 학습량 유지와 취약 유형 보완을 통해 한 단계씩 확실한 등급 상승을 기대할 수 있습니다.`;
                    } else {
                        // Low Std -> Clustered
                        if (rank <= Math.ceil(total * 0.25)) {
                            stdLevelMsg = `표준편차 ${stdVal}(전체 ${totalStd}개교 중 격차 ${stdRank}위)로 점수가 밀집해 있으며, 평균 점수 또한 높습니다. 다수의 학생들이 고득점 구간에 촘촘히 몰려 있는 평이한 시험 환경으로, 단 1~2점 차이로 내신 등급이 크게 요동칠 수 있으므로 완벽한 검토 습관이 요구됩니다.`;
                        } else if (rank >= Math.ceil(total * 0.75)) {
                            stdLevelMsg = `표준편차 ${stdVal}(전체 ${totalStd}개교 중 격차 ${stdRank}위)로 촘촘히 밀집해 있으며 평균 점수는 매우 낮습니다. 극도로 어려운 난이도 탓에 대부분 학생들의 점수가 하향 평준화되어 하위 점수대에 몰려 있습니다. 서술형 부분 점수 1점까지 집요하게 챙기는 근성이 등급 역전의 지름길입니다.`;
                        } else {
                            stdLevelMsg = `표준편차 ${stdVal}(전체 ${totalStd}개교 중 격차 ${stdRank}위)로 학생들의 성적이 특정 점수대에 촘촘하게 밀집되어 있는 학교입니다. 학력 수준이 균일하거나 특정 난이도대에 다수가 몰린 구조로, 서술형 채점 기준 등 미세한 차이가 전체 내신 순위를 가르는 결정적 요인이 됩니다.`;
                        }
                    }
                    const featureText = info.feature ? `전반적으로 [${info.feature}]라는 출제 특징을 보입니다. ` : '';
                    return `${name}의 수학 내신은 ${featureText}이번 지표 분석 결과, ` + stdLevelMsg;
                }

                // ───── A등급 비율 기준 분석 ─────
                if (selectedRankMetric === 'gradeA') {
                    if (gradeAVal === null || gradeAVal === undefined) return `${name} 수학 A등급 데이터 미공시`;
                    let aLevelMsg = '';
                    if (aRank <= Math.ceil(totalA * 0.25)) {
                        if (rank <= Math.ceil(total * 0.25)) {
                            aLevelMsg = `A등급 비율 ${gradeAVal}%(전체 ${totalA}개교 중 ${aRank}위)로 최상위권 비중이 지역 내 가장 높으며 평균 점수 또한 최상위입니다. 시험의 난이도 장벽이 매우 낮아 절대평가 고득점자가 극도로 밀집되어 있습니다. 확실한 내신 1등급을 위해서는 만점에 가까운 무결점 학습이 선행되어야 합니다.`;
                        } else if (stdRank <= Math.ceil(totalStd * 0.25)) {
                            aLevelMsg = `A등급 비율 ${gradeAVal}%(전체 ${totalA}개교 중 ${aRank}위)로 상위권 학생은 많지만 표준편차도 큰 편입니다. 하위권과의 격차가 커서 기본기만 충실히 다져도 중간 등급 이상으로 빠르게 진입할 여력이 있는 양극화 구조입니다.`;
                        } else {
                            aLevelMsg = `A등급 비율 ${gradeAVal}%(전체 ${totalA}개교 중 ${aRank}위)로 지역 내에서 고득점 학생의 밀도가 가장 높은 편에 속합니다. 1~2등급을 확보하기 위한 최상위권 내 경쟁이 소수점 단위로 갈릴 만큼 치열하며, 서술형 완성도와 실수 최소화가 성적의 핵심 축입니다.`;
                        }
                    } else if (aRank <= Math.ceil(totalA * 0.75)) {
                        aLevelMsg = `A등급 비율 ${gradeAVal}%(전체 ${totalA}개교 중 ${aRank}위)로 최상위권 학생들의 비율이 균형 있게 분포하고 있습니다. 기본적인 변별력이 명확히 확보된 안정적 시험 환경이며, 고난도 문항 1~2개와 서술형에서 유의미한 점수를 추가로 획득해야 안정적인 A등급 진입이 가능한 정석적인 경쟁 구조입니다.`;
                    } else {
                        if (rank <= Math.ceil(total * 0.75) && rank > Math.ceil(total * 0.25) && stdRank > Math.ceil(totalStd * 0.75)) {
                             aLevelMsg = `A등급 비율 ${gradeAVal}%(전체 ${totalA}개교 중 ${aRank}위)로 매우 낮으며 점수는 중간대에 밀집해 있습니다. 까다로운 변별력 문항으로 인해 다수가 중위권 점수대에 머물러 있으며, 남들이 틀리는 준킬러 문항을 선별해 하나 더 맞히는 전략이 강력한 등급 역전의 기회가 됩니다.`;
                        } else {
                             aLevelMsg = `A등급 비율 ${gradeAVal}%(전체 ${totalA}개교 중 ${aRank}위)로 A등급 컷(90점 이상)을 넘는 고득점 학생이 지역 내에서 가장 적은 최고난도 환경입니다. 시험이 압도적으로 까다로워 대다수 학생의 득점이 제한되었으며, 이러한 환경에서 A등급을 취득하는 것 자체만으로도 타 학교 대비 매우 탁월한 수학적 역량을 입증하는 강력한 지표가 됩니다.`;
                        }
                    }
                    const featureText = info.feature ? `전반적으로 [${info.feature}]라는 출제 특징을 보입니다. ` : '';
                    return `${name}의 수학 내신은 ${featureText}이번 지표 분석 결과, ` + aLevelMsg;
                }
            }

                        // ───── 비(非)수학 과목 공통 helper ─────
            const subjectLabel = subject;
            const rankSuffix = `(${total}개교 중 ${rank}위)`;

            // 표준편차 기준: 공통 메시지
            if (selectedRankMetric === 'std' && subject !== '수학') {
                if (stdVal === null || stdVal === undefined) return `${name} ${subject} 표준편차 데이터 미공시`;
                const stdPct2 = totalStd > 0 ? Math.round((1 - (stdRank - 1) / totalStd) * 100) : 0;
                const highStd2 = stdRank <= Math.ceil(totalStd * 0.35);
                const lowStd2 = stdRank > Math.ceil(totalStd * 0.65);
                const mathAvg = s['수학'];
                const subjectStdMsg = highStd2
                    ? `${subject} 표준편차 ${stdVal}은 ${totalStd}개교 중 ${stdRank}위(상위 ${stdPct2}%)로, 이 학교의 ${subject} 점수 분포가 상당히 양극화되어 있음을 보여줍니다. 상위권 학생과 하위권 학생 간의 점수 격차가 크기 때문에 성실하게 준비한 학생과 그렇지 않은 학생 간의 등급 차이가 명확하게 나타납니다. 꾸준한 학습과 철저한 범위 정리가 이 환경에서 유리한 위치를 확보하는 핵심 전략입니다.`
                    : lowStd2
                    ? `${subject} 표준편차 ${stdVal}은 ${totalStd}개교 중 ${stdRank}위로, 이 학교의 ${subject} 점수 분포가 매우 촘촘하게 집중되어 있음을 보여줍니다. 대부분의 학생이 비슷한 점수대에 몰려 있어 단 1~2문항의 실수가 바로 등급 하락으로 이어지는 고집중 경쟁 환경입니다. 빈틈없는 범위 학습과 실수 방지 훈련이 이 환경에서 등급을 지키는 핵심입니다.`
                    : `${subject} 표준편차 ${stdVal}은 ${totalStd}개교 중 ${stdRank}위로, 이 학교의 ${subject} 점수 분포는 적절하게 분산된 편입니다. 기본 개념을 충실히 숙달하고 심화 문항에 대한 준비를 갖춘 학생이라면 상위 등급 진입이 현실적인 목표가 되는 환경입니다. 범위 내 모든 개념을 빠짐없이 정리하고 실수를 최소화하는 꼼꼼함이 필요합니다.`;
                return subjectStdMsg;
            }

            // A등급 기준: 공통 메시지
            if (selectedRankMetric === 'gradeA' && subject !== '수학') {
                if (gradeAVal === null || gradeAVal === undefined) return `${name} ${subject} A등급 데이터 미공시`;
                const aPct2 = totalA > 0 ? Math.round((1 - (aRank - 1) / totalA) * 100) : 0;
                const highA2 = aRank <= Math.ceil(totalA * 0.35);
                const lowA2 = aRank > Math.ceil(totalA * 0.65);
                const subjectAMsg = highA2
                    ? `${subject} A등급 비율 ${gradeAVal}%는 ${totalA}개교 중 ${aRank}위(상위 ${aPct2}%)입니다. 상대적으로 많은 학생이 A등급을 받는 학교로, 시험 범위를 성실히 학습하고 핵심 개념을 완전히 숙지한다면 A등급 진입이 충분히 가능합니다. 다만 A등급 학생이 많아 경쟁이 치열하므로, 세부 개념의 완성도와 실수 방지 능력이 A등급과 B등급을 가르는 핵심 변수입니다.`
                    : lowA2
                    ? `${subject} A등급 비율 ${gradeAVal}%는 ${totalA}개교 중 ${aRank}위로, A등급 취득이 매우 어려운 학교입니다. 시험 범위 내 모든 개념을 최상위 수준으로 완성하고 심화 문항에도 대응할 수 있는 실력을 갖춘 학생만이 A등급을 받을 수 있는 환경입니다. A등급 진입을 목표로 한다면 기본 개념의 완벽한 숙달과 함께 고난도 변형 문항에 대한 집중적인 대비가 필요합니다.`
                    : `${subject} A등급 비율 ${gradeAVal}%는 ${totalA}개교 중 ${aRank}위입니다. 적절한 수준의 A등급 경쟁이 이루어지는 환경으로, 시험 범위를 충실히 학습하고 1~2개의 심화 문항까지 대응할 수 있는 학생이라면 A등급 진입이 가능합니다. 꼼꼼한 범위 학습과 심화 개념 정리를 병행하는 것이 A등급 취득의 핵심 전략입니다.`;
                return subjectAMsg;
            }

            // 평균 기준: 기존 과목별 상세 분석
            if (subject === '국어') {
                const mathScore = s['수학'];
                let crossMsg = '';
                if (mathScore !== null && mathScore !== undefined) {
                    const diff = score - mathScore;
                    if (diff >= 8) crossMsg = `수학과 비교했을 때 평균 점수가 ${diff.toFixed(1)}점 높아서 상위권 밀집도가 높아 국어 과목의 내신 변별력은 낮은 편입니다. 시험 범위에 대한 반복 학습과 쉬운 문제의 실수 방지가 상위권 진입의 열쇠입니다. `;
                    else if (diff <= -8) crossMsg = `수학과 비교했을 때 평균 점수가 ${Math.abs(diff).toFixed(1)}점 낮아서 오히려 상위권 변별력이 수학보다 높아 국어에 강한 학생들에게 유리한 학교입니다. 다양한 외부 지문에 대한 대비, 복합 선지 분석력, 시간 관리 능력을 갖추어야 상위권 진입이 가능합니다.`;
                    else crossMsg = `평균 점수가 수학과 비슷한 수준으로 수학과 유사한 변별력을 발휘하는 학교입니다. 내신 범위에 대한 심화 학습과 출제 가능성이 높은 외부 지문에 대한 추가 학습을 통해서 상위권에 진입하는 것이 가능합니다.`;
                }
                const tierMsg = {
                    A: `평균 점수 ${score}점으로 ${topQ ? `전체 ${total}개교 중 ${rank}위입니다.` : '상위권 그룹에 속하는 학교입니다.'} 시험 범위를 꼼꼼하게 공부한다면 충분히 고득점이 가능하지만, 1문제의 실수가 등급 하락으로 이어질 수 있는 위험성이 높습니다.`,
                    B: `평균 점수 ${score}점인 학교로 크게 어렵지 않지만 문법 영역 실수 방지, 산문 문학 분석 능력과 지문 분석 속도를 끌어올리는 것이 상위 등급 진입을 위한 핵심 능력입니다.`,
                    C: `평균 점수 ${score}점인 학교로 상대적으로 어렵게 출제되므로 운문 문학 분석 능력과 모의고사 변형 문제에 대한 대응력을 높여야만 상위 등급 진입이 가능합니다.`,
                    D: `평균 점수 ${score}점인 학교로 매우 어렵게 출제되므로 문법, 비문학 독해와 문학 감상 모두 높은 완성도를 갖추어야 합니다. 외부 지문 분석력과 시간 관리 능력까지 완성해야 상위 등급 진입이 가능합니다.`,
                };
                return crossMsg + tierMsg[tier];
            }

            if (subject === '영어') {
                const mathScore = s['수학'];
                let crossMsg = '';
                if (mathScore !== null && mathScore !== undefined) {
                    const diff = score - mathScore;
                    if (diff >= 8) crossMsg = `평균 성적이 수학보다 ${diff.toFixed(1)}점 높아 변별력이 낮은 학교로, 영어의 문법·독해·추론 능력을 모두 갖추면서도 절대 실수를 하지 않아야 상위 등급을 받을 수 있습니다. `;
                    else if (diff <= -8) crossMsg = `평균 성적이 수학보다 ${Math.abs(diff).toFixed(1)}점 낮아 상대적으로 변별력이 높은 편입니다. 독해·어법 정답률을 높이는 동시에 킬러 문항에 대한 전략적 판단과 시간 관리까지 신경써야만 상위 등급이 가능합니다. `;
                    else crossMsg = `평균 성적이 수학과 유사한 수준으로 비슷한 변별력을 발휘하는 학교입니다. 시험 전범위 제시문 이해, 제시문 변형 문항 대비, 풍부한 어휘력을 갖춰야 상위 등급이 가능합니다. `;
                }
                const tierMsg = {
                    A: `평균 ${score}점인 학교로 어법·독해·추론의 전 영역에서 고른 완성도를 요구합니다. ${topQ ? `전체 ${total}개교 중 ${rank}위` : '상대적으로 변별력이 낮기 때문에 실수를 하지 않는 꼼꼼함이 상위권 진입을 결정합니다.'}`,
                    B: `평균 ${score}점인 학교로 상대적으로 쉬운 문제를 출제하고 있습니다. 고득점자 밀집도가 높기 때문에 독해 지문 처리 속도 향상, 변형 제시문 대응력 강화, 어법 오답 패턴 분석이 상위권 진입의 핵심입니다.`,
                    C: `평균 ${score}점인 학교로 영어 시험이 상대적으로 어렵게 출제됩니다. 어법·독해·추론 능력 모두 심화 완성 상태에 도달해야 하며 변형 지문 대응력과 시간 관리 능력까지 갖추어야 상위권 진입이 가능합니다.`,
                    D: `평균 ${score}점인 학교로 영어 시험의 변별력이 상당히 높은 편입니다. 최상위 수준의 영어 실력은 기본이며 킬러 문제에 대한 전략적 판단 능력, 흔들리지 않는 멘탈, 시간 관리 능력 등 총체적인 시험 응시 능력을 길러야 상위권에 진입할 수 있습니다.`,
                };
                return crossMsg + tierMsg[tier];
            }

            if (subject === '사회') {
                const others = [s['수학'], s['국어'], s['영어']].filter(v => v !== null && v !== undefined);
                let crossMsg = '';
                if (others.length > 0) {
                    const avg3 = others.reduce((a, b) => a + b, 0) / others.length;
                    const diff = score - avg3;
                    if (diff >= 6) crossMsg = `국·영·수 평균보다 ${diff.toFixed(1)}점 높아 사회의 변별력이 낮으며, 주요 과목에 대한 시간 투자를 늘릴 수 있는 학교입니다. `;
                    else if (diff <= -6) crossMsg = `국·영·수 평균보다 ${Math.abs(diff).toFixed(1)}점 낮아 사회의 변별력이 높은 편이며, 사회 과목에 강점을 가진 학생은 주요 과목의 등급을 보완할 수 있는 기회를 제공하는 학교입니다. `;
                    else crossMsg = `주요 과목과 유사한 평균 점수로 적절한 변별력을 갖추고 있으므로 심화 개념에 의해서 등급이 결정되는 학교입니다. `;
                }
                const tierMsg = {
                    A: `평균 ${score}점으로 전체 ${total}개교 중 ${rank}위입니다. 시험 범위의 기본 개념을 숙지하고 적용할 수 있으면 상위 등급 진입이 가능하지만, 고득점자가 많아 1문제 실수가 등급 하락으로 이어질 수 있습니다.`,
                    B: `평균 ${score}점인 학교로 등급 변별을 위한 1~2문제의 심화형 문제에 대한 대응에 의해서 등급이 결정됩니다. 실수 방지는 물론 단원간 통합형 문제와 심화형 문제에 대한 대응력을 길러야 합니다.`,
                    C: `평균 ${score}점인 학교로 심화 문제의 비중이 상대적으로 높습니다. 개념을 통합적으로 적용하는 문항을 해결할 수 있는 심화 학습과 시간 관리 능력을 갖추어야 상위 등급이 가능합니다.`,
                    D: `평균 ${score}점인 학교로 사회 과목의 성적이 전체 등급에 영향력을 발휘하는 학교입니다. 지역·세계화·정치·경제 전 단원에 걸쳐 높은 이해도를 갖추어야 하며, 모의고사의 킬러 문항을 해결할 수 있는 실력이 요구됩니다.`,
                };
                return crossMsg + tierMsg[tier];
            }

            if (subject === '과학') {
                const others = [s['수학'], s['국어'], s['영어']].filter(v => v !== null && v !== undefined);
                let crossMsg = '';
                if (others.length > 0) {
                    const avg3 = others.reduce((a, b) => a + b, 0) / others.length;
                    const diff = score - avg3;
                    if (diff >= 6) crossMsg = `국·영·수 평균보다 ${diff.toFixed(1)}점 높아 과학의 변별력은 낮지만, 학습 부담이 적어 주요 과목에 투자할 수 있는 시간을 확보할 수 있습니다. `;
                    else if (diff <= -6) crossMsg = `국·영·수 평균보다 ${Math.abs(diff).toFixed(1)}점 낮아 과학 과목의 변별력이 높은 편이며, 공학 계열을 희망하는 학생들은 학생부 관리 측면에서 강점을 확보할 수 있습니다. `;
                    else crossMsg = `주요 과목과 균형 잡힌 변별력을 지니고 있으므로, 전과목에서 우수함을 유지하려는 학생들에게 좋은 학생부 기록을 제공할 수 있는 학교입니다. `;
                }
                const tierMsg = {
                    A: `평균 ${score}점으로 전체 ${total}개교 중 ${rank}위입니다. 각 단원의 기본 개념을 단원별로 정리한다면 충분히 상위 등급 진입이 가능하지만, 1등급 변별을 위한 2~3문제의 심화 문제에 대한 대응력을 갖추어야 합니다.`,
                    B: `평균 ${score}점인 학교로 기본 개념 정리와 함께 통합형 응용 문항에 대한 대비를 충실히 해야만 상위 등급 진입이 가능합니다. 모의고사 기출 변형 문제에 대한 정확한 대응력도 필요합니다.`,
                    C: `평균 ${score}점인 학교로 계산형 문항 훈련과 실험 해석 능력까지 갖추어야 상위 등급에 진입할 수 있습니다. 개념과 문제 풀이 능력 이외에도 시간 관리 능력까지 갖추어야 실력이 시험 성적으로 이어집니다.`,
                    D: `평균 ${score}점인 학교로 다른 고등학교에 비해 어렵게 출제됩니다. 과학 전 영역에 대한 융합적 문제 해결력을 갖추어야 하며, 심화 개념, 융합 개념, 복잡한 계산 능력, 낯선 유형의 문제 풀이 능력, 어려운 문제에서의 침착함까지 요구되는 환경입니다.`,
                };
                return crossMsg + tierMsg[tier];
            }

            return `${selectedAchievementYear}년 ${selectedAchievementGrade} ${name} ${subject} 평균 ${score}점(전체 ${rank}위).`;
        }

        function renderAchievementTable(data) {
            const table = document.getElementById('achievementTable');
            Array.from(table.getElementsByTagName('tbody')).forEach(tb => tb.remove());
            data.forEach((item, index) => {
                const sd = item[selectedAchievementSubject];
                const avg = sd ? sd.avg : null;
                const std = sd ? sd.std : null;
                const isNull = avg === null || avg === undefined;

                // Stacked achievement bar
                let distBar = '';
                if (!isNull && sd) {
                    const segs = [
                        { lbl: 'A', val: sd.A, color: '#22c55e' },
                        { lbl: 'B', val: sd.B, color: '#818cf8' },
                        { lbl: 'C', val: sd.C, color: '#facc15' },
                        { lbl: 'D', val: sd.D, color: '#fb923c' },
                        { lbl: 'E', val: sd.E, color: '#f87171' },
                    ].filter(p => p.val !== null && p.val !== undefined);
                    const total = segs.reduce((s, p) => s + p.val, 0);
                    if (total > 0) {
                        distBar = `<div class="flex h-3.5 rounded-full overflow-hidden w-full min-w-[100px] cursor-default" title="${segs.map(p => `${p.lbl}:${p.val}%`).join(' | ')}">` +
                            segs.map(p => `<div style="width:${(p.val / total * 100).toFixed(1)}%;background:${p.color}" title="${p.lbl}: ${p.val}%"></div>`).join('') +
                            `</div><div class="flex gap-2 mt-2 text-[10px] text-slate-500 font-bold">` +
                            segs.map(p => `<span style="color:${p.color}">${p.lbl}:${p.val}%</span>`).join('') +
                            `</div>`;
                    }
                }

                const commentText = generateAchievementComment(item, selectedAchievementSubject, data);

                const tableBody = document.createElement('tbody');
                tableBody.className = 'group transition-colors border-b border-slate-100 last:border-0 hover:bg-slate-50';
                tableBody.innerHTML = `
                    <tr>
                        <td class="px-6 pt-5 pb-1 align-middle text-slate-500 font-black border-none">${index + 1}</td>
                        <td class="px-6 pt-5 pb-1 align-middle font-black text-slate-800 whitespace-nowrap border-none">${item.name}</td>
                        <td class="px-6 pt-5 pb-1 align-middle whitespace-nowrap border-none ${isNull ? 'text-slate-400 italic' : 'text-slate-700 font-black'}">${isNull ? '미공시' : avg + '점'}</td>
                        <td class="px-6 pt-5 pb-1 align-middle whitespace-nowrap border-none ${std === null || std === undefined ? 'text-slate-400 italic text-[11px]' : 'text-indigo-600 font-black'}">${std !== null && std !== undefined ? std : '미공개'}</td>
                        <td class="px-6 pt-5 pb-1 align-middle border-none">${distBar || '<span class="text-slate-400 italic text-[10px]">미공시</span>'}</td>
                    </tr>
                    <tr>
                        <td colspan="5" class="px-6 pb-5 pt-1 border-none">
                            <div class="text-[12px] text-indigo-700 leading-relaxed bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3 shadow-sm">
                                <span class="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-black shrink-0 uppercase tracking-tighter">Analysis</span>
                                <span class="font-bold">${commentText}</span>
                            </div>
                        </td>
                    </tr>
                `;
                table.appendChild(tableBody);
            });
        }

        function initAchievementDashboard() {
            setAchievementYear(selectedAchievementYear);
            setAchievementGrade(selectedAchievementGrade);
            setAchievementSubject(selectedAchievementSubject);
        }
        function initSubjectChart() {
            const ctx = document.getElementById('subjectWeightChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['수학', '영어', '국어', '탐구'],
                    datasets: [{
                        label: '평균 표준편차 (점)',
                        data: [20.5, 13.5, 12.1, 14.8],
                        backgroundColor: [
                            '#6366f1', // Indigo (Math)
                            '#475569',
                            '#475569',
                            '#334155'
                        ],
                        borderRadius: 4,
                        barThickness: 16
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y', // Horizontal bar for modern look
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#e2e8f0',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: false,
                            cornerRadius: 12,
                        }
                    },
                    scales: {
                        x: { display: false, grid: { display: false } },
                        y: { border: { display: false }, grid: { display: false }, ticks: { font: { weight: 'bold', size: 12 }, color: '#cbd5e1' } }
                    }
                }
            });
        }

        function initScatterChart(dataSubset) {
            const ctx = document.getElementById('scatterChart').getContext('2d');

            const chartData = dataSubset.map(item => ({
                x: item.avg,
                y: item.stdDev,
                schoolInfo: item
            }));

            // Dark theme friendly badge colors mapping
            const colorMap = {
                '최상': '#ef4444', // Red
                '상': '#f97316',   // Orange
                '중상': '#f59e0b', // Amber
                '중': '#10b981',   // Emerald
                '중하': '#3b82f6'  // Blue
            };

            if (scatterChartInstance) scatterChartInstance.destroy();

            scatterChartInstance = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Schools',
                        data: chartData,
                        backgroundColor: chartData.map(d => colorMap[d.schoolInfo.diff] || '#94a3b8'),
                        pointRadius: 7,
                        pointHoverRadius: 10,
                        pointBorderColor: 'rgba(255,255,255,0.8)',
                        pointBorderWidth: 1.5,
                        hoverBackgroundColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            const dataIndex = elements[0].index;
                            const schoolData = chartData[dataIndex].schoolInfo;
                            openSchoolModal(schoolData);
                        }
                    },
                    onHover: (event, chartElement) => {
                        event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#e2e8f0',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            borderWidth: 1,
                            padding: 12,
                            bodyFont: { size: 13 },
                            cornerRadius: 12,
                            callbacks: {
                                label: (context) => {
                                    const d = context.raw.schoolInfo;
                                    return `${d.name} (평균: ${d.avg}, 편차: ${d.stdDev})`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: '수학 평균 점수 (X축)', color: '#64748b', font: { weight: 'bold' } },
                            min: 40, max: 80,
                            grid: { color: 'rgba(0, 0, 0, 0.05)', borderDash: [5, 5] },
                            ticks: { color: '#94a3b8' }
                        },
                        y: {
                            title: { display: true, text: '표준편차 (Y축)', color: '#64748b', font: { weight: 'bold' } },
                            min: 10, max: 25,
                            grid: { color: 'rgba(0, 0, 0, 0.05)', borderDash: [5, 5] },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        }


        /* -------------------------------------------------------------------------- */
        /* 3. Table and Modal Logistics                                               */
        /* -------------------------------------------------------------------------- */
        function renderTable(dataSubset) {
            const tbody = document.getElementById('schoolTableBody');
            tbody.innerHTML = '';

            const sortedData = [...dataSubset].sort((a, b) => a.avg - b.avg);

            sortedData.forEach(item => {
                let badgeStyle = '';
                if (item.diff === '최상') badgeStyle = 'bg-red-50 text-red-600 border-red-100';
                else if (item.diff === '상') badgeStyle = 'bg-orange-50 text-orange-600 border-orange-100';
                else if (item.diff === '중상') badgeStyle = 'bg-amber-50 text-amber-600 border-amber-100';
                else if (item.diff === '중') badgeStyle = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                else if (item.diff === '중하') badgeStyle = 'bg-blue-50 text-blue-600 border-blue-100';

                // We can't attach onclick with raw strings easily without escaping, so we use stringified JSON
                // However, modern approach is to assign inline function that accesses closure or global find function

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-0 group';
                tr.onclick = () => openSchoolModal(item);
                tr.innerHTML = `
                    <td class="px-6 py-5 font-bold text-slate-800 group-transition-all flex items-center gap-2">
                        ${item.name}
                        <svg class="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </td>
                    <td class="px-6 py-5 font-black text-slate-700">${item.avg.toFixed(1)}</td>
                    <td class="px-6 py-5 font-black text-primary">${item.stdDev.toFixed(1)}</td>
                    <td class="px-6 py-5">
                        <span class="px-3 py-1 rounded-full text-[10px] font-black border ${badgeStyle} tracking-tighter uppercase transition-all group-hover:shadow-sm">
                            ${item.diff}
                        </span>
                    </td>
                    <td class="px-6 py-5 text-slate-500 font-medium truncate max-w-md group-hover:text-slate-800 transition-colors">
                        ${item.feature}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function updateDataYear(year) {
            currentDataYear = year;

            // UI Update
            document.querySelectorAll('.year-btn').forEach(btn => {
                btn.className = 'year-btn text-textMuted px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-slate-100 hover:text-primary transition-all text-left';
            });
            const activeBtn = document.getElementById(`btn-${year}`);
            if (activeBtn) {
                activeBtn.className = 'year-btn bg-white shadow-sm border border-slate-200 text-primary px-4 py-2.5 text-sm font-bold rounded-xl transition-all text-left';
            }

            const tableYearDisplay = document.getElementById('tableYearDisplay');
            if (tableYearDisplay) tableYearDisplay.innerText = year;

            const filteredData = allData.filter(d => d.year === year);
            renderTable(filteredData);
            initScatterChart(filteredData);
        }

        // Modal Handlers
        function openSchoolModal(data) {
            const modal = document.getElementById('schoolModal');
            const backdrop = document.getElementById('modalBackdrop');
            const panel = document.getElementById('modalPanel');

            // Populate data
            document.getElementById('modalSchoolName').textContent = data.name;
            document.getElementById('modalAvg').textContent = data.avg;
            document.getElementById('modalStd').textContent = data.stdDev;
            document.getElementById('modalFeature').textContent = data.feature;
            document.getElementById('modalComment').textContent = data.comment;

            // Set badge
            const badge = document.getElementById('modalDiffBadge');
            badge.textContent = data.diff;
            badge.className = 'px-3 py-1 rounded text-xs font-bold border '; // reset
            if (data.diff === '최상') badge.className += 'bg-red-50 text-red-600 border-red-100';
            else if (data.diff === '상') badge.className += 'bg-orange-50 text-orange-600 border-orange-100';
            else if (data.diff === '중상') badge.className += 'bg-amber-50 text-amber-600 border-amber-100';
            else if (data.diff === '중') badge.className += 'bg-emerald-50 text-emerald-600 border-emerald-100';
            else if (data.diff === '중하') badge.className += 'bg-blue-50 text-blue-600 border-blue-100';

            // Handle exam file link
            const fileContainer = document.getElementById('modalExamFileContainer');
            const fileLink = document.getElementById('modalExamFileLink');

            if (fileContainer && fileLink) {
                if (schoolFiles[data.name]) {
                    fileLink.href = './' + encodeURIComponent(schoolFiles[data.name]);
                    fileContainer.classList.remove('hidden');
                } else {
                    fileContainer.classList.add('hidden');
                    fileLink.href = '#';
                }
            }

            // Show
            modal.classList.remove('hidden');
            // Trigger reflow
            void modal.offsetWidth;

            backdrop.classList.remove('opacity-0');
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }

        function closeModal() {
            const backdrop = document.getElementById('modalBackdrop');
            const panel = document.getElementById('modalPanel');

            backdrop.classList.add('opacity-0');
            panel.classList.remove('opacity-100', 'scale-100');
            panel.classList.add('opacity-0', 'scale-95');

            setTimeout(() => {
                document.getElementById('schoolModal').classList.add('hidden');
            }, 300); // match transition duration
        }

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('schoolModal').classList.contains('hidden')) {
                closeModal();
            }
        });

        /* -------------------------------------------------------------------------- */
        /* 4. Student Profiler Logic Engine                                           */
        /* -------------------------------------------------------------------------- */
        function calculateRecommendation() {
            const mathSkill = document.getElementById('mathSkill').value;
            const mistakes = document.getElementById('mistakes').value;
            const otherSubjects = document.getElementById('otherSubjects').value;

            const resultDiv = document.getElementById('recommendationResult');
            const contentDiv = document.getElementById('resultContent');

            // Animation Reset
            resultDiv.classList.remove('hidden', 'animate-fade-in');
            void resultDiv.offsetWidth; // trigger reflow
            resultDiv.classList.add('animate-fade-in');

            let profileType = '';
            let schools = '';
            let logic = '';

            if (mathSkill === 'elite' && otherSubjects === 'weak') {
                profileType = "👑 수학 한우물 킬러형";
                schools = "낙생고, 분당중앙고, 서현고";
                logic = `수학에 모든 역량을 집중하는 유형으로, 킬러 문항을 확실히 잡아내는 것이 전체 등급의 핵심입니다. 낙생고는 수능 킬러급, 분당중앙고는 논리 추론형, 서현고는 서술형 논리력을 무기로 각각 차별화된 수학 내신 등급 확보가 가능합니다. 수학 한 과목에서 독보적인 우위를 점하는 전략이 유효합니다.`;
            }
            else if (mathSkill === 'elite') {
                profileType = "👑 최상위 킬러 돌파형";
                schools = "낙생고, 분당대진고, 분당중앙고";
                logic = `수학 내신 평균이 50~57점대로 매우 낮고 표준편차가 18 이상인 학교에 진학할 때 유리한 유형입니다. 압도적인 킬러 문항 해결 능력을 바탕으로, 다수의 학생들이 틀리는 고난도 문항에서 독보적인 득점을 통해 전체 수학 내신 등급을 견인할 수 있습니다. 낙생고는 수능 킬러급, 분당대진고는 계산량 과다 변형형, 분당중앙고는 논리 추론형으로 각각 특화된 출제 환경입니다.`;
            }
            else if (mathSkill === 'solid' && mistakes === 'low' && otherSubjects === 'strong') {
                profileType = "🛡️ 전방위 상위권형";
                schools = "수내고, 보평고, 분당고";
                logic = `수학에서 안정적인 실력을 갖추고 타과목도 강한 전방위 상위권 유형입니다. 수내고는 서술형 완성도, 보평고는 신유형 대응력, 분당고는 어떤 난이도에서도 흔들리지 않는 심리적 강인함이 경쟁력의 핵심입니다. 전체 내신 평균을 극대화하는 전략적 학교 선택이 중요합니다.`;
            }
            else if (mathSkill === 'solid' && mistakes === 'low') {
                profileType = "🛡️ 전과목 무결점 강자형";
                schools = "수내고, 보평고, 이매고";
                logic = `난이도 중~중상 수준의 변형 문항과 서술형이 주로 출제되는 학교에서 강점을 발휘할 수 있는 유형입니다. 킬러 문항 해결력보다 제한 시간 내에 실수 없이 완벽하게 문제를 풀어내는 견고함이 1~2등급을 안정적으로 유지하는 핵심입니다. 수내고는 서술형 완성도, 보평고는 신유형 대응력, 이매고는 준킬러 공략 능력이 각각 차별화 요소입니다.`;
            }
            else if ((mathSkill === 'careful' || mathSkill === 'struggle') && otherSubjects === 'strong') {
                profileType = "📚 타과목 전략적 활용형";
                schools = "늘푸른고, 판교고, 태원고";
                logic = `수학 문항이 비교적 평이하게 출제되는 중하 난이도 학교에 가장 적합한 유형입니다. 수학에서 안정적으로 등급을 방어하면서, 국어·영어·탐구 과목의 압도적인 상위 등급을 성취해 전체 내신 평점을 끌어올리는 전략입니다. 늘푸른고는 내신형 특화 문항, 판교고는 자기주도 학습 환경, 태원고는 기본 개념 중심의 출제로 수학 부담이 상대적으로 낮습니다.`;
            }
            else if (mistakes === 'high' && mathSkill !== 'struggle') {
                profileType = "⚠️ 서술형 부분점수 전략형";
                schools = "서현고, 수내고, 돌마고";
                logic = `객관식 빠른 속도 풀이가 요구되는 학교는 불리합니다. 대신 풀이 과정에서 부분 점수를 충분히 확보할 수 있는 서술형 비중이 높은 학교를 전략적으로 선택하는 것이 유효합니다. 서현고는 논리적 서술이 핵심, 수내고는 서술형 배점이 크고, 돌마고는 서술형 논리성이 등급을 결정합니다. 꼼꼼한 답안 서술 훈련으로 점수 하락 폭을 최소화하는 것이 핵심 전략입니다.`;
            }
            else if (mistakes === 'high' && mathSkill === 'struggle') {
                profileType = "📝 실수 방지 집중 훈련형";
                schools = "불곡고, 한솔고, 운중고";
                logic = `기본 개념 중심으로 출제되고 채점 기준이 명확한 학교에 적합한 유형입니다. 불곡고는 교과·부교재 충실형으로 예측 가능성이 높고, 한솔고는 기초 중심으로 반복 숙달이 효과적이며, 운중고는 꾸준한 노력이 성적에 정직하게 반영되는 환경입니다. 실수 방지와 기본 개념 완성에 집중하면 안정적인 등급을 유지할 수 있습니다.`;
            }
            else {
                profileType = "🌱 꾸준한 성적 향상형";
                schools = "이매고, 태원고, 운중고";
                logic = `학습 노력이 성적에 정직하게 반영되는 학교들입니다. 이매고는 준킬러 도전 여부만 전략적으로 판단하면 등급 방어가 가능하고, 태원고는 기본 개념 숙달과 시간 안배가 핵심이며, 운중고는 꾸준한 반복 학습이 명확한 성적 상승으로 이어집니다. 선행이 부족하더라도 현행 개념을 반복 숙달하면 단계적 등급 상승이 가능한 환경입니다.`;
            }

            contentDiv.innerHTML = `
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-xs font-bold text-emerald-600 bg-emerald-600/10 px-2 py-1 rounded border border-emerald-500/20">AI 종합 매칭 완료</span>
                </div>
                <h4 class="text-2xl font-extrabold text-slate-800 mb-4">${profileType}</h4>
                <div class="mb-5">
                    <span class="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        추천 타겟 학교 
                        <span class="text-[10px] font-normal text-emerald-600 ml-1">(클릭하여 상세 정보 확인)</span>
                    </span>
                    <div class="flex flex-wrap gap-2">
                        ${schools.split(', ').map(school => `<button onclick="findAndOpenSchool('${school}')" class="px-4 py-2 bg-primary text-white hover:bg-primaryHover rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center gap-1.5 font-black">${school}</button>`).join('')}
                    </div>
                </div>
                </div>
                <div class="pt-6 border-t border-slate-100 relative mt-4">
                    <span class="block text-[10px] font-black text-indigo-600 mb-3 uppercase tracking-widest flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        데이터 기반 분석 근거
                    </span>
                    <p class="text-[13px] text-slate-600 leading-relaxed font-bold bg-slate-50/80 p-5 rounded-2xl border border-slate-100 shadow-inner">${logic}</p>
                </div>
            `;
        }

        // Helper function for recommendation buttons
        function findAndOpenSchool(schoolName) {
            const schoolData = allData.find(d => d.name === schoolName && d.year === currentDataYear);
            if (schoolData) {
                openSchoolModal(schoolData);
            }
        }

        function generateSubjectAnalysis(schoolSubjects, studentStrong) {
            const profile = STRONG_PROFILE[studentStrong];
            if (!schoolSubjects) return null;

            const subjShortLabel = { '국어':'국어', '영어':'영어', '수학':'수학', '사회':'사회', '과학':'과학' };

            // 균형형 학생: 단순 분당 비교만
            if (studentStrong === 'bal') {
                const easier = [];   // 학교 평균 > 분당 평균 (시험 쉬움 → 등급 따기 편함)
                const harder = [];   // 학교 평균 < 분당 평균 (시험 어려움 → 등급 따기 어려움)
                Object.keys(BUNDANG_AVG).forEach(s => {
                    const diff = schoolSubjects[s].avg - BUNDANG_AVG[s];
                    if (diff >= 3) easier.push(subjShortLabel[s]);
                    else if (diff <= -3) harder.push(subjShortLabel[s]);
                });
                let msg = `과목별 분석: `;
                if (easier.length) msg += `${easier.join('·')}는 분당 평균보다 시험이 평이해 등급 확보가 수월합니다. `;
                if (harder.length) msg += `${harder.join('·')}는 분당 평균보다 어려워 집중 학습이 필요합니다. `;
                if (!easier.length && !harder.length) msg += `전 과목이 분당 평균과 비슷한 수준으로 균형 잡힌 시험 환경입니다.`;
                return msg.trim();
            }

            // 강·약 과목 분리 학생 (math, kor)
            // 유리 조건:
            //   - 강한 과목의 학교 평균이 분당보다 낮음 → 변별력 환경에서 강점 발휘 (1등급 확보 유리)
            //   - 약한 과목의 학교 평균이 분당보다 높음 → 시험이 평이해 등급 손실 최소화
            // 불리 조건:
            //   - 강한 과목의 학교 평균이 분당보다 높음 → 만점 경쟁으로 강점이 묻힘
            //   - 약한 과목의 학교 평균이 분당보다 낮음 → 어려운 시험에서 약점 노출

            const advantages = [];   // 유리한 과목
            const disadvantages = []; // 불리한 과목

            profile.strong.forEach(s => {
                const diff = schoolSubjects[s].avg - BUNDANG_AVG[s];
                const schoolAvg = schoolSubjects[s].avg.toFixed(1);
                const bundangAvg = BUNDANG_AVG[s].toFixed(1);
                if (diff <= -3) {
                    advantages.push(`강점 과목인 ${subjShortLabel[s]}이(가) 학교 평균 ${schoolAvg}점으로 분당 평균(${bundangAvg}점)보다 낮아 변별력이 확보된 환경에서 1등급 차지하기에 유리`);
                } else if (diff >= 3) {
                    disadvantages.push(`강점 과목인 ${subjShortLabel[s]}이(가) 학교 평균 ${schoolAvg}점으로 분당 평균(${bundangAvg}점)보다 높아 만점 경쟁이 치열하여 강점 발휘가 어려울 수 있음`);
                }
            });

            profile.weak.forEach(s => {
                const diff = schoolSubjects[s].avg - BUNDANG_AVG[s];
                const schoolAvg = schoolSubjects[s].avg.toFixed(1);
                const bundangAvg = BUNDANG_AVG[s].toFixed(1);
                if (diff >= 3) {
                    advantages.push(`약점 과목인 ${subjShortLabel[s]}이(가) 학교 평균 ${schoolAvg}점으로 분당 평균(${bundangAvg}점)보다 높아 시험이 평이하여 등급 손실을 최소화할 수 있음`);
                } else if (diff <= -3) {
                    disadvantages.push(`약점 과목인 ${subjShortLabel[s]}이(가) 학교 평균 ${schoolAvg}점으로 분당 평균(${bundangAvg}점)보다 낮아 어려운 시험에서 약점이 더 크게 드러날 위험`);
                }
            });

            // 종합 판정
            let summary = '';
            const advCount = advantages.length;
            const disCount = disadvantages.length;
            if (advCount >= 2 && disCount === 0) {
                summary = `[${profile.label} 학생에게 매우 유리한 학교]`;
            } else if (advCount >= 1 && disCount === 0) {
                summary = `[${profile.label} 학생에게 유리한 학교]`;
            } else if (advCount === 0 && disCount >= 2) {
                summary = `[${profile.label} 학생에게 불리한 학교]`;
            } else if (advCount === 0 && disCount >= 1) {
                summary = `[${profile.label} 학생에게 다소 불리한 학교]`;
            } else if (advCount > disCount) {
                summary = `[${profile.label} 학생에게 대체로 유리한 학교]`;
            } else if (disCount > advCount) {
                summary = `[${profile.label} 학생에게 대체로 불리한 학교]`;
            } else {
                summary = `[${profile.label} 학생에게 양면성이 공존하는 학교]`;
            }

            const detail = [...advantages, ...disadvantages];
            if (detail.length === 0) {
                return `과목별 분석: ${summary} — 전 과목이 분당 평균과 유사한 수준으로 학생 강·약점에 큰 영향을 받지 않는 균형 잡힌 시험 환경입니다.`;
            }
            return `과목별 분석: ${summary} ${detail.join('. ')}.`;
        }
        // ============ 트랙 점수 산출 ============
        function calculateTrackScores(a) {
            const score = { jeon: 0, gj: 0, hb: 0, il: 0 };

            // 1단계: 학업 준비 (가중 25)
            const mathMap = {
                6: {jeon:10, gj:7,  hb:3,  il:1},
                5: {jeon:7,  gj:10, hb:5,  il:1},
                4: {jeon:3,  gj:7,  hb:10, il:3},
                3: {jeon:1,  gj:4,  hb:8,  il:7},
                2: {jeon:0,  gj:2,  hb:5,  il:9},
                1: {jeon:0,  gj:1,  hb:3,  il:10}
            };
            const sciMap = {
                5: {jeon:10, gj:6,  hb:2,  il:1},
                4: {jeon:5,  gj:10, hb:6,  il:2},
                3: {jeon:1,  gj:5,  hb:10, il:5},
                2: {jeon:0,  gj:2,  hb:6,  il:9},
                1: {jeon:0,  gj:1,  hb:3,  il:10}
            };
            for (const t of ['jeon','gj','hb','il']) score[t] += (mathMap[a.math][t] + sciMap[a.sci][t]) / 2 * 1.25;

            // 2단계: 학습 환경 (가중 20)
            const famMap = { 1: {jeon:8,gj:2,hb:3,il:4}, 2: {jeon:5,gj:6,hb:6,il:6}, 3: {jeon:3,gj:9,hb:8,il:7} };
            const mbtiMap = {
                4: {jeon:10, gj:5, hb:4, il:2},
                3: {jeon:6,  gj:9, hb:6, il:4},
                2: {jeon:3,  gj:6, hb:8, il:7},
                1: {jeon:1,  gj:3, hb:6, il:10}
            };
            const senseMap = { 1: {jeon:9,gj:7,hb:4,il:3}, 2: {jeon:4,gj:5,hb:9,il:7}, 3: {jeon:1,gj:3,hb:5,il:9} };
            for (const t of ['jeon','gj','hb','il']) score[t] += (famMap[a.fam][t] + mbtiMap[a.mbti][t] + senseMap[a.sense][t]) / 3 * 2.0;

            // 3단계: 학업 균형 (가중 25)
            const rankMap = { 3: {jeon:10,gj:8,hb:6,il:4}, 2: {jeon:4,gj:9,hb:8,il:6}, 1: {jeon:1,gj:3,hb:7,il:9} };
            const strongMap = { math: {jeon:8,gj:10,hb:6,il:3}, kor: {jeon:4,gj:3,hb:7,il:9}, bal: {jeon:6,gj:6,hb:7,il:7} };
            for (const t of ['jeon','gj','hb','il']) score[t] += (rankMap[a.rank][t] + strongMap[a.strong][t]) / 2 * 2.5;

            // 4단계: 체력 (가중 10)
            const stamMap = { 3: {jeon:10,gj:8,hb:7,il:6}, 2: {jeon:5,gj:7,hb:8,il:8}, 1: {jeon:1,gj:3,hb:5,il:7} };
            for (const t of ['jeon','gj','hb','il']) score[t] += stamMap[a.stamina][t] * 1.0;

            // 5단계: 전략 (가중 20)
            const stratMap = {
                susi:    { jeon:10, gj:4, hb:6, il:8 },
                bal:     { jeon:6,  gj:8, hb:10, il:4 },
                jeongsi: { jeon:5,  gj:10, hb:8, il:3 }
            };
            for (const t of ['jeon','gj','hb','il']) score[t] += stratMap[a.strategy][t] * 2.0;

            const maxScore = 87.5;
            const pct = {};
            for (const t of ['jeon','gj','hb','il']) pct[t] = Math.min(100, Math.round(score[t] / maxScore * 100));
            return pct;
        }

        // ============ 트랙 → 그룹 매핑 ============
        function trackToGroups(winner) {
            const map = {
                jeon: ['jasago', 'science', 'high'],
                gj:   ['science', 'high', 'avg'],
                hb:   ['high', 'science', 'avg'],
                il:   ['avg', 'high']
            };
            return map[winner];
        }

        // ============ 그룹 내 학교 점수화 (상세 사유) ============
        function rankSchoolsInGroup(groupKey, a, commute) {
            if (groupKey === 'jasago') {
                return [{
                    name: '전국 자사고',
                    data: SCHOOL_DATA.JASAGO_GROUP,
                    fit: 95,
                    reasons: [
                        '학생 프로필이 전국 단위 자사고 진학 요건에 매우 적합한 수준입니다.',
                        '강한 선행 진도, 외향성, 체력, 수시 집중 전략 등 전사고 합격생 평균 프로파일과 일치합니다.',
                        '구체적인 학교 추천은 본 진단 범위를 벗어나며, 전형 일정·면접 준비를 별도 상담받으시기 바랍니다.'
                    ]
                }];
            }

            const schools = Object.entries(SCHOOL_DATA)
                .filter(([n, d]) => d.group === groupKey)
                .map(([name, data]) => {
                    let fit = 50;
                    const reasons = [];

                    const mathAvg = data.subjects.수학.avg;
                    const mathSd = data.subjects.수학.sd;
                    const korAvg = data.subjects.국어.avg;
                    const engAvg = data.subjects.영어.avg;

                    // 1) 성적대 적합도
                    if (a.rank === 3) {
                        if (mathAvg <= 65 && mathSd >= 17) {
                            fit += 25;
                            reasons.push(`수학 평균 ${mathAvg}점·표준편차 ${mathSd}로 변별력이 매우 높아, 상위권 학생이 1등급을 확보하기에 유리한 시험 환경입니다.`);
                        } else if (mathAvg <= 70) {
                            fit += 12;
                            reasons.push(`수학 평균 ${mathAvg}점 수준으로 상위권 학생에게 적정한 난이도가 형성되어 있습니다.`);
                        } else {
                            fit -= 5;
                            reasons.push(`수학 평균 ${mathAvg}점이 다소 높아 상위권 변별이 약할 수 있으며, 만점 경쟁에 진입할 가능성이 있습니다.`);
                        }
                    } else if (a.rank === 2) {
                        if (mathAvg >= 60 && mathAvg <= 70 && mathSd >= 14 && mathSd <= 18) {
                            fit += 22;
                            reasons.push(`수학 평균 ${mathAvg}점·표준편차 ${mathSd}로 중상위권에게 가장 이상적인 난이도 분포를 보이고 있습니다.`);
                        } else if (mathAvg >= 65) {
                            fit += 10;
                            reasons.push(`평균과 편차 분포로 보아 중상위권이 등급을 안정적으로 확보할 수 있는 환경입니다.`);
                        } else {
                            reasons.push(`평균 수준이 다소 낮은 편이나 노력 여하에 따라 상위 등급 진입이 가능합니다.`);
                        }
                    } else {
                        if (mathAvg >= 68 && mathSd <= 16) {
                            fit += 25;
                            reasons.push(`수학 평균 ${mathAvg}점·표준편차 ${mathSd}로 평균이 높고 편차가 작아, 중위권 학생이 안정적인 등급을 확보하기 가장 유리합니다.`);
                        } else if (mathAvg >= 65) {
                            fit += 12;
                            reasons.push(`평균 수준이 무난하고 시험이 평이한 편이어서 중위권 학생에게 큰 부담이 없습니다.`);
                        } else {
                            fit -= 8;
                            reasons.push(`수학 평균 ${mathAvg}점·편차 ${mathSd}로 시험 난이도가 높아 중위권 학생에게는 부담스러운 환경입니다.`);
                        }
                    }

                    // 2) 강점 영역 보정
                    if (a.strong === 'math' && (data.diff === '최상' || data.diff === '상')) {
                        fit += 8;
                        reasons.push(`수학·과학에 강점이 있는 학생이 변별력 있는 시험에서 자신의 강점을 최대한 활용할 수 있습니다.`);
                    } else if (a.strong === 'kor' && (data.diff === '중하' || data.diff === '중')) {
                        fit += 6;
                        reasons.push(`국어 평균 ${korAvg}점·영어 평균 ${engAvg}점 환경에서 국영 강점 학생이 수학 부담을 덜고 강세 과목으로 등급을 끌어올릴 수 있습니다.`);
                    } else if (a.strong === 'bal') {
                        fit += 3;
                        reasons.push(`균형형 학생에게는 전 과목 고른 학습이 유효하게 작용합니다.`);
                    }

                    // 3) 전략 보정
                    if (a.strategy === 'susi' && mathSd <= 16) {
                        fit += 6;
                        reasons.push(`표준편차가 작아 시험 변동성이 낮으므로, 학생부 관리를 중심으로 한 수시 전략에 적합합니다.`);
                    } else if (a.strategy === 'jeongsi' && mathSd >= 17) {
                        fit += 6;
                        reasons.push(`높은 변별력의 시험 환경이 정시 수능 대비에도 도움이 되는 학교입니다.`);
                    } else if (a.strategy === 'bal') {
                        fit += 4;
                        reasons.push(`내신과 수능을 균형 있게 준비하기에 무리 없는 환경입니다.`);
                    }

                    // 4) 학교 특성
                    reasons.push(`학교 특성: ${data.feature}`);

                    // 4-1) 과목별 유불리 분석 (학생 강·약점 vs 학교 평균)
                    const subjectAnalysis = generateSubjectAnalysis(data.subjects, a.strong);
                    if (subjectAnalysis) {
                        reasons.push(subjectAnalysis);
                        // 적합도 추가 보정: 분석 결과가 "유리"면 +5, "불리"면 -5
                        if (subjectAnalysis.includes('매우 유리한')) fit += 8;
                        else if (subjectAnalysis.includes('유리한 학교') && !subjectAnalysis.includes('불리')) fit += 5;
                        else if (subjectAnalysis.includes('대체로 유리')) fit += 3;
                        else if (subjectAnalysis.includes('매우 불리') || subjectAnalysis.includes('불리한 학교')) fit -= 5;
                        else if (subjectAnalysis.includes('대체로 불리')) fit -= 3;
                    }

                    // 5) 통학 보정
                    if (commute && commute !== 'all' && data.region !== commute) {
                        fit -= 12;
                        reasons.push(`⚠️ 학생의 통학 가능 범위(${REGION_LABEL[commute]}) 외 지역에 위치하여 등하교 부담이 있을 수 있습니다.`);
                    } else if (commute && commute !== 'all' && commute === data.region) {
                        fit += 4;
                        reasons.push(`통학 가능 범위 내에 위치해 등하교 시간을 학습에 활용할 수 있습니다.`);
                    }

                    fit = Math.max(20, Math.min(98, fit));

                    return { name, data, fit, reasons };
                })
                .sort((a, b) => b.fit - a.fit);

            return schools;
        }

        // ============ 결과 렌더링 ============
        function runDiagnosis(a) {
            const pct = calculateTrackScores(a);
            const labels = { jeon: '전사고 트랙', gj: '과중반 트랙', hb: '높은 일반고 트랙', il: '평균 일반고 트랙' };
            const colors = {
                jeon: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                gj:   'linear-gradient(90deg, #14b8a6, #0d9488)',
                hb:   'linear-gradient(90deg, #3b82f6, #2563eb)',
                il:   'linear-gradient(90deg, #f59e0b, #d97706)'
            };

            const sorted = Object.entries(pct).sort((a, b) => b[1] - a[1]);
            const winner = sorted[0][0];
            const second = sorted[1][0];
            const gap = sorted[0][1] - sorted[1][1];

            const groupOrder = trackToGroups(winner);
            const commute = answers.commute || 'all';

            const recommendations = [];
            for (const groupKey of groupOrder) {
                const ranked = rankSchoolsInGroup(groupKey, a, commute);
                for (const sch of ranked) {
                    if (recommendations.length < 3 && sch.fit >= 35) {
                        recommendations.push(sch);
                    }
                }
                if (recommendations.length >= 3) break;
            }
            if (recommendations.length < 3) {
                const secondGroups = trackToGroups(second);
                for (const groupKey of secondGroups) {
                    if (groupOrder.includes(groupKey)) continue;
                    const ranked = rankSchoolsInGroup(groupKey, a, commute);
                    for (const sch of ranked) {
                        if (recommendations.length < 3 && sch.fit >= 35 &&
                            !recommendations.find(r => r.name === sch.name)) {
                            recommendations.push(sch);
                        }
                    }
                    if (recommendations.length >= 3) break;
                }
            }

            // 신뢰도
            let confidence, confColor, confExplain;
            if (gap >= 15) {
                confidence = '높음';
                confColor = 'text-emerald-600';
                confExplain = '1순위와 2순위 트랙 간 점수 격차가 명확하므로, 추천 트랙에 집중하셔도 무방합니다.';
            } else if (gap >= 7) {
                confidence = '보통';
                confColor = 'text-amber-600';
                confExplain = '1순위 트랙이 우세하나, 차순위 트랙도 충분히 검토할 가치가 있습니다.';
            } else {
                confidence = '낮음';
                confColor = 'text-red-600';
                confExplain = '1순위와 2순위 트랙 간 점수 격차가 매우 작아, 두 트랙을 모두 검토하시는 것을 권장합니다.';
            }

            // 트랙 상세 설명
            const trackDetail = {
                jeon: `전사고 트랙은 학생의 선행 진도, 외향성, 체력, 수시 집중 전략 등이 모두 최상위권 자사고 합격생 평균 프로파일과 일치할 때 권장됩니다. 강도 높은 학습 환경에서도 흔들리지 않는 학생에게 적합하며, 가족 환경의 영향을 비교적 덜 받는 독립적 학습 능력이 요구됩니다.`,
                gj: `과중반(과학중점) 트랙은 수학·과학에 뚜렷한 강점이 있고 정시 또는 정시 균형 전략을 택하는 상위권 학생에게 적합합니다. 화목한 가족 환경과 차분한 외향성이 시너지를 내며, 이공계열 진학을 염두에 둔 학생에게 최적의 선택지가 됩니다.`,
                hb: `높은 일반고 트랙은 균형 잡힌 성적대와 보통 수준의 환경 적응력, 정시 균형 전략에 가장 잘 맞는 트랙입니다. 내신과 수능을 함께 안정적으로 챙길 수 있어 다양한 진학 옵션을 열어 두고자 하는 학생에게 권장됩니다.`,
                il: `평균 일반고 트랙은 국어·영어에 강점이 있거나 환경 변화에 예민한 성향, 또는 수시 집중·정시 균형 전략을 택하는 학생에게 적합합니다. 학생부 관리가 핵심이며, 비교적 안정적인 환경에서 등급을 확보하기 유리합니다.`
            };

            const stratLabel = { susi: '수시 집중', bal: '정시 균형', jeongsi: '정시 집중' };
            const tagClass = { jasago: 'tag-jasago', science: 'tag-science', high: 'tag-high', avg: 'tag-avg' };
            const mathLabel = ['','현행 진도 학습 중','공통수학 Ⅰ 완료','공통수학 Ⅱ 완료','대수 완료','미적분 Ⅰ 완료','미적분 Ⅱ 완료'];
            const sciLabel = ['','현행 진도 학습 중','과학 기본','과학 심화','과학 Ⅰ 학습 중','과학 Ⅱ 학습 중'];
            const mbtiLabel = ['','강한 내향형 (I)','약한 내향형 (i)','약한 외향형 (e)','강한 외향형 (E)'];

            // === HTML 빌드 ===
            let html = `
                <div class="card mb-6 animate-slide-up">
                    <h2 class="text-xl font-black text-slate-900 mb-1">진단 결과 — 권장 트랙</h2>
                    <p class="text-sm text-slate-500 mb-1">신뢰도: <span class="font-bold ${confColor}">${confidence}</span> (1·2위 격차 ${gap}점)</p>
                    <p class="text-xs text-slate-400 mb-5">${confExplain}</p>

                    ${sorted.map(([t, v]) => `
                        <div class="track-bar">
                            <span class="track-label">${labels[t]}</span>
                            <div class="track-track">
                                <div class="track-fill" style="width:${v}%; background:${colors[t]}"></div>
                            </div>
                            <span class="track-val">${v}점</span>
                        </div>
                    `).join('')}

                    <div class="mt-5 p-4 bg-indigo-50 rounded-xl text-sm text-indigo-900 leading-relaxed">
                        <p class="font-bold mb-2">📌 권장 트랙: ${labels[winner]}</p>
                        <p>${trackDetail[winner]}</p>
                        ${gap < 7 ? `<p class="mt-3 pt-3 border-t border-indigo-200"><b>※ 차순위 ${labels[second]}와 점수 차이가 작습니다.</b><br>${trackDetail[second]}</p>` : ''}
                    </div>
                </div>

                <div class="card mb-6 animate-slide-up">
                    <h2 class="text-xl font-black text-slate-900 mb-2">추천 학교 — 1·2·3순위</h2>
                    <p class="text-sm text-slate-500 mb-5">진단 결과·성적대·시험 패턴·통학 범위를 종합한 적합도 순위입니다. 각 학교의 추천 사유와 과목별 평균·표준편차를 함께 확인하시기 바랍니다.</p>

                    <div class="space-y-4">
            `;

            recommendations.forEach((rec, i) => {
                const rankClass = `rank-${i+1}`;
                const rankLabels = ['1순위', '2순위', '3순위'];
                const groupTag = tagClass[rec.data.group];
                const isJasago = rec.data.group === 'jasago';

                let subjectTable = '';
                let radarBlock = '';
                if (!isJasago && rec.data.subjects) {
                    const subjOrder = ['국어', '영어', '수학', '사회', '과학'];
                    const subjLabel = { '국어':'국어', '영어':'영어', '수학':'수학', '사회':'사회', '과학':'과학' };
                    subjectTable = `
                        <table class="subj-table">
                            <thead>
                                <tr>
                                    <th>구분</th>
                                    ${subjOrder.map(s => `<th>${subjLabel[s]}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>평균 점수</td>
                                    ${subjOrder.map(s => `<td class="num">${rec.data.subjects[s].avg.toFixed(1)}</td>`).join('')}
                                </tr>
                                <tr>
                                    <td>표준편차</td>
                                    ${subjOrder.map(s => `<td class="num">${rec.data.subjects[s].sd.toFixed(1)}</td>`).join('')}
                                </tr>
                            </tbody>
                        </table>
                    `;

                    // 레이더 차트 컨테이너 (canvas는 렌더링 후 Chart.js가 그림)
                    radarBlock = `
                        <div class="radar-wrapper">
                            <div class="radar-title">📊 과목별 성적 프로파일</div>
                            <div class="radar-canvas-box">
                                <canvas id="radar-${i}"></canvas>
                            </div>
                            <div class="radar-legend">
                                <div class="radar-legend-item"><span class="radar-legend-dot" style="background:#4f46e5"></span>평균 점수</div>
                                <div class="radar-legend-item"><span class="radar-legend-dot" style="background:#f59e0b"></span>표준편차 (×3 보정)</div>
                            </div>
                            <div class="radar-note">
                                평균이 클수록 시험이 쉬움 · 표준편차가 클수록 변별력 높음<br>
                                ※ 표준편차는 평균과 같은 척도 비교를 위해 3배로 보정 표시
                            </div>
                        </div>
                    `;
                }

                html += `
                    <div class="rank-card ${rankClass}">
                        <div class="flex items-start justify-between flex-wrap gap-2 mb-2">
                            <div>
                                <span class="rank-badge">${rankLabels[i]}</span>
                                <span class="group-tag ${groupTag}">${rec.data.groupName}</span>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-slate-600 font-semibold">적합도</div>
                                <div class="text-2xl font-black text-slate-900">${rec.fit}<span class="text-sm">%</span></div>
                            </div>
                        </div>

                        <h3 class="text-2xl font-black text-slate-900 mb-1">${rec.name}</h3>
                        ${!isJasago ? `<p class="text-xs text-slate-600 mb-2">난이도 <b>${rec.data.diff}</b> · 권역 <b>${REGION_LABEL[rec.data.region] || '-'}</b></p>` : ''}

                        <div class="fit-bar">
                            <div class="fit-fill" style="width:${rec.fit}%"></div>
                        </div>

                        <div class="reason-box">
                            <div class="reason-title">📋 추천 사유</div>
                            <ul class="reason-list">
                                ${rec.reasons.map(r => `<li>${r}</li>`).join('')}
                            </ul>
                        </div>

                        ${subjectTable}
                        ${radarBlock}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>

                <div class="card mb-6 animate-slide-up">
                    <h2 class="text-lg font-black text-slate-900 mb-3">응답 요약</h2>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between border-b border-slate-100 pb-2">
                            <span class="text-slate-500">선행 진도</span>
                            <span class="font-semibold text-slate-800 text-right">수학 ${mathLabel[a.math]} · 과학 ${sciLabel[a.sci]}</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-100 pb-2">
                            <span class="text-slate-500">학습 환경</span>
                            <span class="font-semibold text-slate-800 text-right">${['','불화','보통','화목'][a.fam]} · ${mbtiLabel[a.mbti]} · ${['','둔감','보통','예민'][a.sense]}</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-100 pb-2">
                            <span class="text-slate-500">성적·강점</span>
                            <span class="font-semibold text-slate-800 text-right">${['','중위','중상위','상위'][a.rank]}권 · ${a.strong==='math'?'수과 우세':a.strong==='kor'?'국영 우세':'균형형'}</span>
                        </div>
                        <div class="flex justify-between border-b border-slate-100 pb-2">
                            <span class="text-slate-500">체력 · 전략</span>
                            <span class="font-semibold text-slate-800 text-right">${['','약함','보통','강함'][a.stamina]} · ${stratLabel[a.strategy]}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-500">통학 범위</span>
                            <span class="font-semibold text-slate-800 text-right">${REGION_LABEL[commute] || '미지정'}</span>
                        </div>
                    </div>
                </div>

                <div class="card animate-slide-up bg-slate-50 border-slate-200">
                    <h2 class="text-base font-bold text-slate-700 mb-2">📌 활용 안내</h2>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        본 진단은 6단계 점검 프레임워크의 가중치 모델에 따른 1차 추천입니다.
                        실제 고교 선택 시에는 형제·자매 입학 이력, 학원 동선, 학교별 비교과 활동 환경 등
                        개별 변수를 함께 고려해야 합니다. 차순위 학교와의 비교 상담을 함께 진행하시는 것을 권장합니다.
                    </p>
                </div>

                <div class="flex justify-center mt-8">
                    <button type="button" id="back-btn" class="btn-primary">← 돌아가기 (처음부터 다시 진단)</button>
                </div>
            `;

            const res = document.getElementById('precise-result');
            res.innerHTML = html;
            res.classList.remove('hidden');
            document.getElementById('survey-area').classList.add('hidden');
            res.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // 레이더 차트 렌더링 (자사고 제외)
            recommendations.forEach((rec, i) => {
                if (rec.data.group === 'jasago' || !rec.data.subjects) return;
                const canvas = document.getElementById(`radar-${i}`);
                if (!canvas) return;
                const subjects = rec.data.subjects;
                const labelsR = ['국어', '영어', '수학', '사회', '과학'];
                const avgData = [subjects.국어.avg, subjects.영어.avg, subjects.수학.avg, subjects.사회.avg, subjects.과학.avg];
                // 표준편차는 평균(0~100)과 척도가 달라 3배 보정해서 가시성 확보
                const sdData = [subjects.국어.sd*3, subjects.영어.sd*3, subjects.수학.sd*3, subjects.사회.sd*3, subjects.과학.sd*3];
                const sdRaw = [subjects.국어.sd, subjects.영어.sd, subjects.수학.sd, subjects.사회.sd, subjects.과학.sd];

                new Chart(canvas, {
                    type: 'radar',
                    data: {
                        labels: labelsR,
                        datasets: [
                            {
                                label: '평균 점수',
                                data: avgData,
                                backgroundColor: 'rgba(79, 70, 229, 0.18)',
                                borderColor: '#4f46e5',
                                borderWidth: 2,
                                pointBackgroundColor: '#4f46e5',
                                pointBorderColor: '#fff',
                                pointRadius: 4,
                                pointHoverRadius: 6
                            },
                            {
                                label: '표준편차 (×3)',
                                data: sdData,
                                _rawSd: sdRaw,
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                borderColor: '#f59e0b',
                                borderWidth: 2,
                                borderDash: [5, 4],
                                pointBackgroundColor: '#f59e0b',
                                pointBorderColor: '#fff',
                                pointRadius: 4,
                                pointHoverRadius: 6
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: function(ctx) {
                                        if (ctx.datasetIndex === 1) {
                                            return `표준편차: ${sdRaw[ctx.dataIndex].toFixed(1)}`;
                                        }
                                        return `평균: ${ctx.parsed.r.toFixed(1)}점`;
                                    }
                                }
                            }
                        },
                        scales: {
                            r: {
                                min: 0,
                                max: 100,
                                ticks: {
                                    stepSize: 20,
                                    font: { size: 10 },
                                    color: '#94a3b8',
                                    backdropColor: 'transparent'
                                },
                                grid: { color: 'rgba(148, 163, 184, 0.25)' },
                                angleLines: { color: 'rgba(148, 163, 184, 0.3)' },
                                pointLabels: {
                                    font: { size: 13, weight: '700', family: 'Pretendard' },
                                    color: '#1e293b'
                                }
                            }
                        }
                    }
                });
            });

            // 돌아가기 버튼 (전체 진단 재시작)
            document.getElementById('back-btn').addEventListener('click', () => {
                document.querySelectorAll('.opt-pill.active').forEach(p => p.classList.remove('active'));
                Object.keys(answers).forEach(k => delete answers[k]);
                document.getElementById('survey-area').classList.remove('hidden');
                document.getElementById('precise-result').classList.add('hidden');
                document.getElementById('precise-result').innerHTML = '';
                document.getElementById('status-msg').textContent = '';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }


    // =================================================================
    // [추가 함수 - 통합용]
    // =================================================================

    // ===== 산점도2 (학교별 변별력 지형도) =====
    function initScatterChart2(dataSubset) {
        const canvas = document.getElementById('scatterChart2');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const chartData = dataSubset.map(item => ({ x: item.avg, y: item.stdDev, schoolInfo: item }));
        const colorMap = { '최상': '#ef4444', '상': '#f97316', '중상': '#f59e0b', '중': '#10b981', '중하': '#3b82f6' };
        if (scatterChartInstance2) scatterChartInstance2.destroy();
        scatterChartInstance2 = new Chart(ctx, {
            type: 'scatter',
            data: { datasets: [{
                label: 'Schools', data: chartData,
                backgroundColor: chartData.map(d => colorMap[d.schoolInfo.diff] || '#94a3b8'),
                pointRadius: 8, pointHoverRadius: 11,
                pointBorderColor: 'rgba(255,255,255,0.8)', pointBorderWidth: 1.5,
                hoverBackgroundColor: '#ffffff'
            }]},
            options: {
                responsive: true, maintainAspectRatio: false,
                onClick: (e, elements) => { if (elements.length > 0) { const i = elements[0].index; openSchoolModal(chartData[i].schoolInfo); } },
                onHover: (event, chartElement) => { event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default'; },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)', titleColor: '#fff', bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, padding: 12, bodyFont: { size: 13 }, cornerRadius: 12,
                        callbacks: { label: (context) => { const d = context.raw.schoolInfo; return `${d.name} (평균: ${d.avg}, 편차: ${d.stdDev})`; } }
                    }
                },
                scales: {
                    x: { title: { display: true, text: '수학 평균 점수 (X축)', color: '#64748b', font: { weight: 'bold' } }, min: 40, max: 80, grid: { color: 'rgba(0, 0, 0, 0.05)', borderDash: [5, 5] }, ticks: { color: '#94a3b8' } },
                    y: { title: { display: true, text: '표준편차 (Y축)', color: '#64748b', font: { weight: 'bold' } }, min: 10, max: 25, grid: { color: 'rgba(0, 0, 0, 0.05)', borderDash: [5, 5] }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    // updateDataYear에서 산점도2도 함께 업데이트
    const _origUpdateDataYear = updateDataYear;
    updateDataYear = function(year) {
        _origUpdateDataYear(year);
        const filtered = allData.filter(d => d.year === year);
        initScatterChart2(filtered);
    };

    // ============================================================
    // (③ 학교별 수학 내신 비교 섹션은 데이터 신뢰도 문제로 제거됨 —
    //  ①② 표·산점도와 출처가 달라 같은 학교 평균/표준편차가 불일치하는 문제)
    // ============================================================

    // ===== 학교별/과목별 내신 비교 =====
    let subjCompareYear = 2024;
    let subjCompareGrade = '1학년';
    function setSubjCompareYear(y) {
        subjCompareYear = y;
        selectedAchievementYear = y;
        selectedAchievementGrade = subjCompareGrade;
        ['2023','2024'].forEach(v => {
            const b = document.getElementById('subjCompareYear-' + v);
            if (!b) return;
            if (Number(v) === y) b.className = 'subj-cmp-year px-3 py-1.5 text-[11px] font-black rounded-xl bg-primary text-white';
            else b.className = 'subj-cmp-year px-3 py-1.5 text-[11px] font-black rounded-xl bg-transparent text-slate-500';
        });
        renderCompareRadarChart();
    }
    function setSubjCompareGrade(g) {
        subjCompareGrade = g;
        selectedAchievementYear = subjCompareYear;
        selectedAchievementGrade = g;
        ['1학년','2학년','3학년'].forEach(v => {
            const b = document.getElementById('subjCompareGrade-' + v);
            if (!b) return;
            if (v === g) b.className = 'subj-cmp-grade px-3 py-1.5 text-[11px] font-black rounded-xl bg-primary text-white';
            else b.className = 'subj-cmp-grade px-3 py-1.5 text-[11px] font-black rounded-xl bg-transparent text-slate-500';
        });
        renderCompareRadarChart();
    }

    // ===== 정밀 진단 (v3.4) =====
    const answers = {};
    function attachPreciseListeners() {
        document.querySelectorAll('#view-precise-recommend .opt-group').forEach(group => {
            const q = group.dataset.q;
            group.addEventListener('click', e => {
                const btn = e.target.closest('.opt-pill');
                if (!btn) return;
                group.querySelectorAll('.opt-pill').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const v = btn.dataset.v;
                answers[q] = isNaN(v) ? v : Number(v);
            });
        });
        const runBtn = document.getElementById('run-btn');
        if (runBtn) runBtn.addEventListener('click', () => {
            const required = ['math','sci','fam','mbti','sense','rank','strong','stamina','strategy'];
            const missing = required.filter(k => answers[k] === undefined);
            if (missing.length) {
                document.getElementById('status-msg').textContent = `${missing.length}개 문항이 미응답입니다. 모두 응답해 주세요.`;
                return;
            }
            document.getElementById('status-msg').textContent = '';
            runDiagnosis(answers);
        });
    }

    // ============================================================
    // [3-1] 의학계열 합격 실적 — 학년도 1개 선택 → 그래프 + 표
    // ============================================================
    // 전체 의학계열: 의예/치의예/한의예/약학/수의예 (5개)
    // 서울대 의학계열: 의예/치의예/약학/수의예 (4개, 한의예 없음)
    const MED_CATS_ALL = ['의예','치의예','한의예','약학','수의예'];
    const MED_CATS_SNU = ['의예','치의예','약학','수의예'];
    const MED_COLORS = { '의예': '#4f46e5', '치의예': '#f59e0b', '한의예': '#10b981', '약학': '#ef4444', '수의예': '#a855f7' };
    let medChartInstance = null;
    let medCurrentYear = '2026';

    function switchMedTab(tab) {
        medCurrentTab = tab;
        document.querySelectorAll('.med-tab-btn').forEach(b => {
            if (b.dataset.medtab === tab) b.className = 'med-tab-btn px-5 py-2.5 text-sm font-bold rounded-full bg-primary text-white shadow-md';
            else b.className = 'med-tab-btn px-5 py-2.5 text-sm font-bold rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
        });
        renderMedView();
    }
    function setMedYear(y) {
        medCurrentYear = y;
        document.querySelectorAll('.med-year-btn').forEach(b => {
            if (b.dataset.year === y) b.className = 'med-year-btn px-5 py-2.5 text-sm font-bold rounded-full bg-primary text-white shadow-md';
            else b.className = 'med-year-btn px-5 py-2.5 text-sm font-bold rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
        });
        renderMedView();
    }

    function renderMedView() {
        const data = medCurrentTab === 'snu' ? EXCEL_DATA.snu_medical : EXCEL_DATA.medical;
        const yr = medCurrentYear;
        const tabLabel = medCurrentTab === 'snu' ? '서울대 의학계열' : '전체 의학계열';
        // 탭별 카테고리 (서울대는 한의예 없음)
        const MED_CATS = medCurrentTab === 'snu' ? MED_CATS_SNU : MED_CATS_ALL;

        // 색상 범례 갱신 (탭별로 카테고리가 다름)
        const legend = document.getElementById('medLegend');
        if (legend) {
            legend.innerHTML = '<span class="font-bold text-textMuted">색상 안내:</span>' +
                MED_CATS.map(c => `<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded inline-block" style="background:${MED_COLORS[c]}"></span>${c}</span>`).join('');
        }

        // 합계 내림차순 정렬
        const sorted = [...data]
            .map(d => ({ d, total: d.years[yr]?.['계'] || 0 }))
            .filter(x => true) // 0명도 표시 (정렬 끝에 옴)
            .sort((a,b) => b.total - a.total);

        // 타이틀
        const ev = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        ev('medGraphTitle', `${yr}학년도 ${tabLabel} 합격자 — 내림차순`);
        ev('medTableTitle', `${yr}학년도 ${tabLabel} — 학교별 상세`);

        // === 그래프 (스택 막대) ===
        const labels = sorted.map(x => x.d.school);
        // 카테고리는 데이터에 따라 다름 (서울대 의학은 한의예/수의예가 일부 학년도에 없을 수 있으니 MED_CATS 중 데이터에 있는 것만)
        const dataCats = MED_CATS.filter(c => sorted.some(x => (x.d.years[yr]?.[c] ?? 0) > 0));
        // 단, 정렬 막대에서는 일관성을 위해 항상 5개 카테고리 시도하되, 모두 0이면 자동 제외됨
        const datasets = MED_CATS.map(c => ({
            label: c,
            data: sorted.map(x => x.d.years[yr]?.[c] || 0),
            backgroundColor: MED_COLORS[c],
            borderRadius: 4,
            categoryPercentage: 0.85,
            barPercentage: 0.95,
        }));

        if (medChartInstance) medChartInstance.destroy();
        const ctx = document.getElementById('medChart');
        if (ctx) {
            const totals = sorted.map(x => x.total);
            const maxTotal = Math.max(...totals, 1);

            // datasets 중 데이터가 1개 이상 있는 것만 표시 (전부 0인 카테고리 제외)
            const visibleDatasets = datasets.filter(ds => ds.data.some(v => v > 0));

            // 각 학교별로 "마지막으로 값이 있는 카테고리"가 어디인지 인덱스 계산
            //  → 그 자리에 총합 라벨을 표시 (오른쪽 끝)
            const lastVisibleIdx = sorted.map((_, schoolIdx) => {
                for (let i = visibleDatasets.length - 1; i >= 0; i--) {
                    if (visibleDatasets[i].data[schoolIdx] > 0) return i;
                }
                return -1;
            });

            // 마지막 데이터셋에 총합 라벨 옵션 부착
            visibleDatasets.forEach((ds, dsIdx) => {
                ds.datalabels = {
                    // 1) 막대 칸 안 숫자 (흰색)
                    labels: {
                        inner: {
                            display: (c) => c.dataset.data[c.dataIndex] > 0,
                            anchor: 'center', align: 'center',
                            color: 'white',
                            font: { weight: 900, size: 10 },
                            formatter: (val) => val > 0 ? val : ''
                        },
                        // 2) 학교별 마지막 카테고리에만 총합 표시 (막대 오른쪽 끝)
                        total: {
                            display: (c) => lastVisibleIdx[c.dataIndex] === dsIdx,
                            anchor: 'end', align: 'end', offset: 6,
                            color: '#0f172a',
                            font: { weight: 900, size: 12 },
                            formatter: (val, c) => {
                                const t = totals[c.dataIndex];
                                return t > 0 ? `${t}명` : '';
                            }
                        }
                    }
                };
            });

            medChartInstance = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: { labels, datasets: visibleDatasets },
                plugins: [ChartDataLabels],
                options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    layout: { padding: { right: 80 } },
                    // 한 학교 행에 마우스를 올리면 그 학교의 모든 카테고리 데이터셋이 items로 들어옴
                    interaction: { mode: 'index', axis: 'y', intersect: false },
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 12, font: { size: 12, weight: 'bold' } } },
                        tooltip: {
                            callbacks: {
                                title: (items) => items[0]?.label || '',
                                label: (c) => c.parsed.x > 0 ? `${c.dataset.label}: ${c.parsed.x}명` : null,
                                footer: (items) => {
                                    // 학교 인덱스를 이용해 sorted에서 실제 총합 가져옴 (확실한 방법)
                                    const idx = items[0]?.dataIndex;
                                    if (idx == null) return '';
                                    return `합계: ${totals[idx]}명`;
                                }
                            }
                        },
                        datalabels: { display: false }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            title: { display: true, text: '합격자 수 (명)', color: '#64748b', font: { weight: 'bold' } },
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: { color: '#94a3b8', precision: 0 },
                            suggestedMax: maxTotal * 1.18
                        },
                        y: { stacked: true, grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 12 } } }
                    },
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const fullName = sorted[i].d.school.replace('대진고','분당대진고').replace('중앙고','분당중앙고');
                            findAndOpenSchool(fullName);
                        }
                    }
                }
            });
        }

        // === 표 ===
        let html = '<thead>';
        html += '<tr><th class="perf-year-header" style="width:50px;">순위</th>';
        html += '<th class="school-name perf-year-header" style="text-align:center;">학교명</th>';
        for (const c of MED_CATS) html += `<th class="perf-year-header">${c}</th>`;
        html += '<th class="perf-year-header">합계</th></tr></thead>';
        html += '<tbody>';
        sorted.forEach((x, i) => {
            const d = x.d, yd = d.years[yr] || {};
            const rankColor = i === 0 ? 'text-amber-600 font-black' : i === 1 ? 'text-slate-500 font-black' : i === 2 ? 'text-orange-700 font-black' : 'text-slate-400';
            const fullName = d.school.replace('대진고','분당대진고').replace('중앙고','분당중앙고');
            html += `<tr>`;
            html += `<td><span class="${rankColor}">${i+1}</span></td>`;
            html += `<td class="school-name" onclick="findAndOpenSchool('${fullName}')">${d.school}</td>`;
            for (const c of MED_CATS) {
                const v = yd[c] ?? 0;
                html += `<td class="${v === 0 ? 'zero' : ''}">${v || '-'}</td>`;
            }
            const tot = x.total;
            html += `<td class="total-cell ${tot >= 30 ? 'very-high' : tot >= 10 ? 'high' : ''}">${tot || '-'}</td>`;
            html += '</tr>';
        });
        html += '</tbody>';
        document.getElementById('medTable').innerHTML = html;

        // 인사이트
        const yrSum = sorted.reduce((s,x) => s + x.total, 0);
        ev('med-insight-1-label', `${yr}학년도 ${tabLabel} 1위`);
        ev('med-insight-2-label', `${yr}학년도 ${tabLabel} 2위`);
        ev('med-insight-3-label', `${yr}학년도 ${tabLabel} 18개교 합계`);
        if (sorted[0]) ev('med-insight-1', `${sorted[0].d.school} (${sorted[0].total}명)`);
        if (sorted[1]) ev('med-insight-2', `${sorted[1].d.school} (${sorted[1].total}명)`);
        ev('med-insight-3', `${yrSum}명`);
    }

    // 백워드 호환
    function renderMedicalGrid() { renderMedView(); }
    function renderMedicalTable() { renderMedView(); }
    function setMedSort() { renderMedView(); } // deprecated

    // ============================================================
    // [3-2] 주요 대학 합격 실적 — 학년도 + 그룹 1개 → 그래프 + 표
    // ============================================================
    const UNIV_GROUPS = {
        SKY:  { label: '서연고',     cats: ['서울대','연세대','고려대'],            colors: { '서울대': '#1e40af', '연세대': '#0d9488', '고려대': '#dc2626' } },
        KIST: { label: '과학기술원', cats: ['KAIST','GIST','DGIST','UNIST'],         colors: { 'KAIST': '#4f46e5', 'GIST': '#f59e0b', 'DGIST': '#10b981', 'UNIST': '#ef4444' } },
        SSH:  { label: '성서한이',   cats: ['성균관대','서강대','한양대','이화여대'], colors: { '성균관대': '#7c3aed', '서강대': '#ea580c', '한양대': '#2563eb', '이화여대': '#db2777' } },
        JKO:  { label: '중경외시',   cats: ['중앙대','경희대','한국외대','서울시립대'], colors: { '중앙대': '#dc2626', '경희대': '#ca8a04', '한국외대': '#0891b2', '서울시립대': '#16a34a' } }
    };
    let univCurrentGroup = 'SKY';
    let univChartInstance = null;

    function setUnivYear(y) {
        univCurrentYear = y;
        document.querySelectorAll('.univ-year-btn').forEach(b => {
            if (b.dataset.year === y) b.className = 'univ-year-btn px-5 py-2.5 text-sm font-bold rounded-full bg-primary text-white shadow-md';
            else b.className = 'univ-year-btn px-5 py-2.5 text-sm font-bold rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
        });
        renderUnivView();
    }
    function setUnivGroup(g) {
        univCurrentGroup = g;
        document.querySelectorAll('.univ-group-btn').forEach(b => {
            if (b.dataset.group === g) b.className = 'univ-group-btn px-5 py-2.5 text-sm font-bold rounded-full bg-primary text-white shadow-md';
            else b.className = 'univ-group-btn px-5 py-2.5 text-sm font-bold rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200';
        });
        renderUnivView();
    }

    function renderUnivView() {
        const data = EXCEL_DATA.major;
        const group = UNIV_GROUPS[univCurrentGroup];
        const yr = univCurrentYear;

        // 색상 범례 갱신
        const legend = document.getElementById('univLegend');
        if (legend) {
            legend.innerHTML = '<span class="font-bold text-textMuted">색상 안내:</span>' +
                group.cats.map(c => `<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded inline-block" style="background:${group.colors[c]}"></span>${c}</span>`).join('');
        }

        // 그룹 합계 내림차순
        const sorted = [...data].map(d => {
            const yd = d.years[yr] || {};
            const tot = group.cats.reduce((s,c) => s + (yd[c]||0), 0);
            return { d, tot, yd };
        }).sort((a,b) => b.tot - a.tot);

        // 타이틀
        const ev = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        ev('univGraphTitle', `${yr}학년도 ${group.label} 합격자 — 내림차순`);
        ev('univTableTitle', `${yr}학년도 ${group.label} — 학교별 상세`);

        // === 그래프 ===
        const labels = sorted.map(x => x.d.school);
        const datasets = group.cats.map(c => ({
            label: c,
            data: sorted.map(x => x.yd[c] || 0),
            backgroundColor: group.colors[c],
            borderRadius: 4,
            categoryPercentage: 0.85,
            barPercentage: 0.95,
        }));

        if (univChartInstance) univChartInstance.destroy();
        const ctx = document.getElementById('univChart');
        if (ctx) {
            const totals = sorted.map(x => x.tot);
            const maxTotal = Math.max(...totals, 1);

            const visibleDatasets = datasets.filter(ds => ds.data.some(v => v > 0));
            const lastVisibleIdx = sorted.map((_, schoolIdx) => {
                for (let i = visibleDatasets.length - 1; i >= 0; i--) {
                    if (visibleDatasets[i].data[schoolIdx] > 0) return i;
                }
                return -1;
            });

            visibleDatasets.forEach((ds, dsIdx) => {
                ds.datalabels = {
                    labels: {
                        inner: {
                            display: (c) => c.dataset.data[c.dataIndex] > 0,
                            anchor: 'center', align: 'center',
                            color: 'white',
                            font: { weight: 900, size: 10 },
                            formatter: (val) => val > 0 ? val : ''
                        },
                        total: {
                            display: (c) => lastVisibleIdx[c.dataIndex] === dsIdx,
                            anchor: 'end', align: 'end', offset: 6,
                            color: '#0f172a',
                            font: { weight: 900, size: 12 },
                            formatter: (val, c) => {
                                const t = totals[c.dataIndex];
                                return t > 0 ? `${t}명` : '';
                            }
                        }
                    }
                };
            });

            univChartInstance = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: { labels, datasets: visibleDatasets },
                plugins: [ChartDataLabels],
                options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    layout: { padding: { right: 80 } },
                    interaction: { mode: 'index', axis: 'y', intersect: false },
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 12, font: { size: 12, weight: 'bold' } } },
                        tooltip: {
                            callbacks: {
                                title: (items) => items[0]?.label || '',
                                label: (c) => c.parsed.x > 0 ? `${c.dataset.label}: ${c.parsed.x}명` : null,
                                footer: (items) => {
                                    const idx = items[0]?.dataIndex;
                                    if (idx == null) return '';
                                    return `${UNIV_GROUPS[univCurrentGroup].label} 합계: ${totals[idx]}명`;
                                }
                            }
                        },
                        datalabels: { display: false }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            title: { display: true, text: '합격자 수 (명)', color: '#64748b', font: { weight: 'bold' } },
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: { color: '#94a3b8', precision: 0 },
                            suggestedMax: maxTotal * 1.18
                        },
                        y: { stacked: true, grid: { display: false }, ticks: { color: '#475569', font: { weight: 'bold', size: 12 } } }
                    },
                    onClick: (e, elements) => {
                        if (elements.length > 0) {
                            const i = elements[0].index;
                            const fullName = sorted[i].d.school.replace('대진고','분당대진고').replace('중앙고','분당중앙고');
                            findAndOpenSchool(fullName);
                        }
                    }
                }
            });
        }

        // === 표 ===
        let html = '<thead>';
        html += '<tr><th class="perf-year-header" style="width:50px;">순위</th>';
        html += '<th class="school-name perf-year-header" style="text-align:center;">학교명</th>';
        for (const c of group.cats) html += `<th class="perf-year-header">${c}</th>`;
        html += `<th class="perf-year-header">${group.label} 합계</th></tr></thead>`;
        html += '<tbody>';
        sorted.forEach((x, i) => {
            const d = x.d;
            const rankColor = i === 0 ? 'text-amber-600 font-black' : i === 1 ? 'text-slate-500 font-black' : i === 2 ? 'text-orange-700 font-black' : 'text-slate-400';
            const fullName = d.school.replace('대진고','분당대진고').replace('중앙고','분당중앙고');
            html += `<tr>`;
            html += `<td><span class="${rankColor}">${i+1}</span></td>`;
            html += `<td class="school-name" onclick="findAndOpenSchool('${fullName}')">${d.school}</td>`;
            for (const c of group.cats) {
                const v = x.yd[c] ?? 0;
                html += `<td class="${v === 0 ? 'zero' : ''}">${v || '-'}</td>`;
            }
            const tot = x.tot;
            html += `<td class="total-cell ${tot >= 50 ? 'very-high' : tot >= 20 ? 'high' : ''}">${tot || '-'}</td>`;
            html += '</tr>';
        });
        html += '</tbody>';
        document.getElementById('univTable').innerHTML = html;

        // 인사이트
        const yrSum = sorted.reduce((s,x) => s + x.tot, 0);
        ev('univ-insight-1-label', `${yr}학년도 ${group.label} 1위`);
        ev('univ-insight-2-label', `${yr}학년도 ${group.label} 2위`);
        ev('univ-insight-total-label', `${yr}학년도 ${group.label} 18개교 합계`);
        if (sorted[0]) ev('univ-insight-1', `${sorted[0].d.school} (${sorted[0].tot}명)`);
        if (sorted[1]) ev('univ-insight-2', `${sorted[1].d.school} (${sorted[1].tot}명)`);
        ev('univ-insight-total', `${yrSum}명`);
    }

    // 백워드 호환
    function renderUnivGroupGrid() { renderUnivView(); }
    function renderMajorUnivTable() { renderUnivView(); }

    // ============================================================
    // [4-1] 학교별 배정 결과
    // ============================================================
    function setAssignSort(mode) {
        assignSortMode = mode;
        document.querySelectorAll('.assign-sort-btn').forEach(b => {
            if (b.dataset.sort === mode) b.className = 'assign-sort-btn px-4 py-2 text-xs font-bold rounded-lg bg-primary text-white';
            else b.className = 'assign-sort-btn px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-600';
        });
        renderAssignTable();
    }
    function parseRank(s) {
        if (!s) return 99;
        const m = String(s).match(/(\d+)/);
        return m ? parseInt(m[1]) : 99;
    }
    function rankClass(s) {
        const r = parseRank(s);
        if (r === 99 || s == null || s === '') return 'assign-cell-empty';
        if (r === 1) return 'assign-cell-1';
        if (r === 2) return 'assign-cell-2';
        if (r <= 5) return 'assign-cell-3';
        return 'assign-cell-low';
    }
    function renderAssignTable() {
        const data = EXCEL_DATA.assign;
        const yrs = ['2026','2025','2024','2023'];
        const sorted = [...data];
        if (assignSortMode === 'name') sorted.sort((a,b) => a.school.localeCompare(b.school, 'ko'));
        else {
            sorted.sort((a,b) => {
                const aa = (parseRank(a['2026']?.['남'])+parseRank(a['2026']?.['여']))/2;
                const bb = (parseRank(b['2026']?.['남'])+parseRank(b['2026']?.['여']))/2;
                return aa - bb;
            });
        }
        let html = '<thead>';
        html += '<tr><th rowspan="2" class="school-name perf-year-header" style="text-align:center;">학교명</th>';
        for (const y of yrs) html += `<th colspan="2" class="perf-year-header">${y}년</th>`;
        html += '</tr><tr>';
        for (const y of yrs) html += '<th>남</th><th>여</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        for (const d of sorted) {
            const fullName = d.school.replace('분당영덕여고','영덕여고');
            html += `<tr><td class="school-name" onclick="findAndOpenSchool('${fullName}')">${d.school}</td>`;
            for (const y of yrs) {
                const m = d[y]?.['남'];
                const f = d[y]?.['여'];
                html += `<td class="${rankClass(m)}">${m || '-'}</td>`;
                html += `<td class="${rankClass(f)}">${f || '-'}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody>';
        document.getElementById('assignTable').innerHTML = html;
    }

    function populateAnalysisCards() {
        const grid = document.getElementById('analysisSchoolsGrid');
        if (!grid) return;
        if (grid._populated) return; // 한 번만 채우면 됨
        grid.innerHTML = '';
        schoolNames.forEach(name => {
            const data = baseStats[name];
            if (!data) return;
            let diffBadge = '';
            if (data.diff === '최상') diffBadge = '<span class="px-3 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-600 border border-red-100 uppercase tracking-tighter">최상</span>';
            else if (data.diff === '상') diffBadge = '<span class="px-3 py-1 rounded-full text-[10px] font-black bg-orange-50 text-orange-600 border border-orange-100 uppercase tracking-tighter">상</span>';
            else if (data.diff === '중상') diffBadge = '<span class="px-3 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-tighter">중상</span>';
            else if (data.diff === '중') diffBadge = '<span class="px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-tighter">중</span>';
            else if (data.diff === '중하') diffBadge = '<span class="px-3 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-tighter">중하</span>';

            const card = document.createElement('div');
            card.id = 'analysis-card-' + name;
            card.className = 'bg-white p-6 rounded-3xl border border-slate-100 shadow-md hover:shadow-2xl hover:border-primary/30 transition-all hover:-translate-y-1 group cursor-pointer';
            card.onclick = () => findAndOpenSchool(name);
            card.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-black text-slate-800">${name}</h4>
                    ${diffBadge}
                </div>
                <div class="flex gap-3 mb-4 text-[11px] font-black border-b border-slate-100 pb-3">
                    <div class="text-slate-500">평균 <span class="text-slate-900 ml-0.5 font-black">${data.avg}점</span></div>
                    <div class="text-slate-500">편차 <span class="text-primary ml-0.5 font-black">${data.stdDev}</span></div>
                </div>
                <div class="space-y-3">
                    <div>
                        <span class="block text-[10px] font-black text-indigo-400 mb-1.5 uppercase tracking-widest">출제 특징</span>
                        <p class="text-[12px] text-slate-600 leading-relaxed font-bold">${data.feature}</p>
                    </div>
                    <div class="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100">
                        <span class="block text-[10px] font-black text-indigo-500 mb-1.5 uppercase tracking-widest">⚡ 전략 가이드</span>
                        <p class="text-[11.5px] text-slate-600 leading-relaxed font-medium">${data.comment}</p>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        grid._populated = true;
    }

    // 표 학교명 클릭 시 카드까지 부드럽게 스크롤
    function scrollToSchoolCard(name) {
        const card = document.getElementById('analysis-card-' + name);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // 강조 효과 (반짝임)
            card.style.transition = 'all 0.3s';
            card.style.boxShadow = '0 0 0 3px #4f46e5';
            setTimeout(() => { card.style.boxShadow = ''; }, 1500);
        }
    }

    // findAndOpenSchool 보강: 모달 + 카드 강조
    const _origFindAndOpenSchool = findAndOpenSchool;
    findAndOpenSchool = function(name) {
        _origFindAndOpenSchool(name);
        // 현재 math-deep 탭이면 카드도 강조
        if (currentTab === 'math-deep') {
            setTimeout(() => scrollToSchoolCard(name), 100);
        }
    };

    // ============================================================
    // 초기화
    // ============================================================
    document.addEventListener('DOMContentLoaded', () => {
        try { initSubjectChart(); } catch(e){}
        updateDataYear(2026);
        try { initAchievementDashboard(); } catch(e){}
        attachPreciseListeners();
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('schoolModal').classList.contains('hidden')) closeModal();
        });
    });
    
