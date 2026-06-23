
        const API_URL = 'http://localhost:5000/api';
        let currentUser = null;
        let rowCount = 0;

        document.addEventListener('DOMContentLoaded', () => {
            checkAuth();
        });

        // ================= AUTHENTICATION =================
        function checkAuth() {
            const storedUser = localStorage.getItem('motorcade_user');
            if (storedUser) {
                currentUser = JSON.parse(storedUser);
                document.getElementById('displayUsername').textContent = currentUser.username;
                document.getElementById('userInfo').style.display = 'flex';
                initEmptyTable();
            } else {
                document.getElementById('loginModal').style.display = 'flex';
            }
        }

        async function doLogin() {
            const username = document.getElementById('loginUsername').value.trim();
            if (!username) return alert('กรุณากรอกชื่อผู้ใช้งาน');

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                const data = await res.json();
                
                if (res.ok) {
                    currentUser = { id: data.user_id, username: data.username };
                    localStorage.setItem('motorcade_user', JSON.stringify(currentUser));
                    
                    document.getElementById('displayUsername').textContent = currentUser.username;
                    document.getElementById('userInfo').style.display = 'flex';
                    document.getElementById('loginModal').style.display = 'none';
                    initEmptyTable();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (error) {
                alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่ารัน app.py แล้ว');
            }
        }

        function logout() {
            localStorage.removeItem('motorcade_user');
            location.reload();
        }

        // ================= SERVER API =================
        async function saveToServer() {
            if (!currentUser) return;
            
            const name = prompt("ตั้งชื่อตารางที่ต้องการบันทึก (เช่น 'ขบวนนายก วันที่ 12')", "ตารางใหม่");
            if (!name) return;

            const rows = Array.from(document.querySelectorAll('#tableBody tr')).map(row => ({
                road: row.querySelector('.road-input').value,
                checkpoint: row.querySelector('.checkpoint-input').value,
                distance: row.querySelector('.distance-input').value,
                remarks: row.querySelector('.remarks-input').value
            }));
            
            const scheduleData = {
                unitName: document.getElementById('unitName').value,
                routeName: document.getElementById('routeName').value,
                convoyNum: document.getElementById('convoyNum').value,
                movementPhase: document.getElementById('movementPhase').value,
                phaseDistance: document.getElementById('phaseDistance').value,
                maxSpeed: document.getElementById('maxSpeed').value,
                speedMultiplier: document.getElementById('speedMultiplier').value,
                startTime: document.getElementById('startTime').value,
                speed: document.getElementById('speed').value,
                rows: rows
            };

            try {
                const res = await fetch(`${API_URL}/schedules?user_id=${currentUser.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, data: scheduleData })
                });
                if (res.ok) {
                    showToast();
                }
            } catch (err) {
                alert('ไม่สามารถบันทึกข้อมูลได้');
            }
        }

        async function openHistory() {
            if (!currentUser) return;
            document.getElementById('historyModal').style.display = 'flex';
            const listDiv = document.getElementById('historyList');
            listDiv.innerHTML = '<p style="text-align:center">กำลังโหลด...</p>';

            try {
                const res = await fetch(`${API_URL}/schedules?user_id=${currentUser.id}`);
                const history = await res.json();
                
                if (history.length === 0) {
                    listDiv.innerHTML = '<p style="text-align:center;color:gray">ยังไม่มีประวัติการบันทึก</p>';
                    return;
                }

                listDiv.innerHTML = '';
                history.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML = `
                        <div class="history-info">
                            <strong>${item.name}</strong>
                            <span>บันทึกเมื่อ: ${item.created_at}</span>
                        </div>
                        <div class="history-actions">
                            <button class="btn-save btn-sm btn-load">เปิด</button>
                            <button class="btn-remove btn-sm btn-delete" style="color:white;background:#ef4444">ลบ</button>
                        </div>
                    `;
                    
                    div.querySelector('.btn-load').addEventListener('click', () => loadSchedule(item.data));
                    div.querySelector('.btn-delete').addEventListener('click', () => deleteSchedule(item.id));
                    
                    listDiv.appendChild(div);
                });
            } catch (err) {
                listDiv.innerHTML = '<p style="text-align:center;color:#ef4444">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>';
            }
        }

        async function deleteSchedule(id) {
            if (!confirm('ยืนยันการลบประวัตินี้?')) return;
            try {
                const res = await fetch(`${API_URL}/schedules/${id}?user_id=${currentUser.id}`, { method: 'DELETE' });
                if (res.ok) openHistory(); // reload list
            } catch (err) {
                alert('ลบไม่สำเร็จ');
            }
        }

        function loadSchedule(data) {
            closeModal('historyModal');
            document.getElementById('unitName').value = data.unitName || '';
            document.getElementById('routeName').value = data.routeName || '';
            document.getElementById('convoyNum').value = data.convoyNum || '';
            document.getElementById('movementPhase').value = data.movementPhase || '';
            document.getElementById('phaseDistance').value = data.phaseDistance || '';
            document.getElementById('maxSpeed').value = data.maxSpeed || '';
            document.getElementById('speedMultiplier').value = data.speedMultiplier || '';
            document.getElementById('startTime').value = data.startTime;
            document.getElementById('speed').value = data.speed;
            
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';
            rowCount = 0;
            
            if (data.rows && data.rows.length > 0) {
                data.rows.forEach(r => addRow(r.road, r.checkpoint, r.distance, r.remarks));
            } else {
                initEmptyTable();
            }
        }

        function closeModal(id) {
            document.getElementById(id).style.display = 'none';
        }

        function showToast() {
            const toast = document.getElementById('toast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        // ================= TABLE LOGIC =================
        function formatTime24h(totalMinutes) {
            const roundedMins = Math.round(totalMinutes);
            const h = Math.floor(roundedMins / 60) % 24;
            const m = roundedMins % 60;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        function initEmptyTable() {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';
            rowCount = 0;
            addRow('จุดเริ่มต้น', 'จุดเริ่มขบวน', 0, '');
            addRow('ถ.สายหลัก', 'จุดตรวจ A', 40.5, '');
            addRow('ถ.สายหลัก', 'จุดตรวจ B', 36.9, '');
        }

        function addRow(road = '', checkpoint = '', distance = '', remarks = '') {
            rowCount++;
            const tbody = document.getElementById('tableBody');
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td class="text-center">${rowCount}</td>
                <td><input type="text" class="road-input" value="${road}" placeholder="ชื่อถนน" oninput="calculateTable()"></td>
                <td><input type="text" class="checkpoint-input" value="${checkpoint}" placeholder="จุดตรวจ" oninput="calculateTable()"></td>
                <td><input type="number" class="distance-input text-center" value="${distance}" min="0" step="any" placeholder="0" oninput="calculateTable()"></td>
                <td><span class="calc-value acc-dist">0.00</span></td>
                <td style="display:none;"><span class="calc-value travel-time">0</span></td>
                <td>
                    <div class="time-group">
                        <span class="calc-value time-value arrival-time">--:--</span>
                        <span class="time-label departure-label" style="display:none;">ออก: <span class="departure-time">--:--</span></span>
                    </div>
                </td>
                <td>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="remark-display" style="font-weight:500; white-space: pre-wrap;"></span>
                        <input type="hidden" class="remarks-input" value="${remarks}">
                    </div>
                </td>
                <td>
                    <button class="btn-remove" onclick="removeRow(this)" title="ลบ">ลบ</button>
                </td>
            `;
            tbody.appendChild(tr);
            updateRowNumbers();
            calculateTable();
        }

        function removeRow(btn) {
            const row = btn.closest('tr');
            row.remove();
            updateRowNumbers();
            calculateTable();
        }

        function editRemark(btn) {
            const row = btn.closest('tr');
            const remarkInput = row.querySelector('.remarks-input');
            const currentText = remarkInput.value;
            
            const newText = prompt("พิมพ์หมายเหตุเพิ่มเติม:", currentText);
            if (newText !== null) {
                remarkInput.value = newText.trim();
                calculateTable();
            }
        }

        function updateRowNumbers() {
            const rows = document.querySelectorAll('#tableBody tr');
            rowCount = rows.length;
            rows.forEach((row, index) => {
                row.cells[0].textContent = index + 1;
            });
        }

        function calculateTable() {
            const startTimeInput = document.getElementById('startTime').value;
            const speedInput = parseFloat(document.getElementById('speed').value);
            
            if (!startTimeInput || speedInput <= 0) return;
            
            let [hours, minutes] = startTimeInput.split(':').map(Number);
            let startTimeMins = (hours * 60) + minutes;
            
            let currentOffsetMins = 0; 
            let pureTimeMins = startTimeMins; 
            let accumulatedDistance = 0;
            
            const time12 = 12 * 60; 
            let breaksShown = {};
            let pmBreaksShown = {};
            
            const rows = document.querySelectorAll('#tableBody tr');
            
            rows.forEach((row, index) => {
                const distInput = row.querySelector('.distance-input').value;
                const distance = distInput ? parseFloat(distInput) : 0;
                
                accumulatedDistance += distance;
                
                let travelMins = 0;
                if (distance > 0) {
                    travelMins = (distance / speedInput) * 60;
                }
                
                let prevActual = pureTimeMins + currentOffsetMins;
                pureTimeMins += travelMins;
                let newActual = pureTimeMins + currentOffsetMins;
                
                let delayAddedHere = 0;
                
                if (prevActual < time12 && newActual >= time12) {
                    currentOffsetMins += 60; 
                    delayAddedHere = 60;
                    newActual += 60;
                }

                // --- SP / RP Logic for Remarks ---
                const remarkInput = row.querySelector('.remarks-input');
                const remarkDisplay = row.querySelector('.remark-display');
                let remarkText = remarkInput.value;
                
                // Clean up any old markers (front or back)
                remarkText = remarkText.replace(/^(SP|\(SP\)|RP|\(RP\))\s*/i, '');
                remarkText = remarkText.replace(/\s*(RP|\(RP\))$/i, '');
                remarkText = remarkText.replace(/พัก \d{2} นาที\s+กม\.\d+(\.\d+)?\s+เวลา\s+\d{2}:\d{2}-\d{2}:\d{2}\s*/gi, '');
                remarkText = remarkText.replace(/พักกลางวัน\s+กม\.\d+(\.\d+)?\s+เวลา\s+12:00-13:00\s*/gi, '');
                
                remarkInput.value = remarkText;

                let systemRemarks = [];
                
                // --- Break Logic ---
                let totalTravelMins = pureTimeMins - startTimeMins;
                const milestones = [
                    {h: 1, dur: 15},
                    {h: 3, dur: 10},
                    {h: 5, dur: 10},
                    {h: 7, dur: 10},
                    {h: 9, dur: 10},
                    {h: 11, dur: 10}
                ];

                milestones.forEach(m => {
                    let targetMins = m.h * 60;
                    if (totalTravelMins >= targetMins && !breaksShown[m.h]) {
                        breaksShown[m.h] = true;
                        const breakB = startTimeMins + targetMins;
                        if (m.h === 1 || breakB < 12 * 60) {
                            const breakC = breakB + m.dur;
                            const breakA = speedInput * m.h;
                            systemRemarks.push(`พัก ${m.dur} นาที กม.${breakA} เวลา ${formatTime24h(breakB)}-${formatTime24h(breakC)}`);
                        }
                    }
                });

                // --- Lunch Break Logic ---
                if (delayAddedHere > 0) {
                    let lunchHours = (12 * 60 - startTimeMins) / 60;
                    let lunchA = Math.round(speedInput * lunchHours * 100) / 100;
                    systemRemarks.push(`พักกลางวัน กม.${lunchA} เวลา 12:00-13:00`);
                }

                // --- PM Break Logic ---
                const pmMilestones = [
                    { target: 15 * 60, pmH: 2, dur: 10 },
                    { target: 17 * 60, pmH: 4, dur: 10 },
                    { target: 19 * 60, pmH: 6, dur: 10 },
                    { target: 21 * 60, pmH: 8, dur: 10 },
                    { target: 23 * 60, pmH: 10, dur: 10 }
                ];
                
                pmMilestones.forEach(pm => {
                    if (newActual >= pm.target && !pmBreaksShown[pm.target]) {
                        pmBreaksShown[pm.target] = true;
                        let preLunchHours = (12 * 60 - startTimeMins) / 60;
                        let breakA = (preLunchHours * speedInput) + (pm.pmH * speedInput);
                        breakA = Math.round(breakA * 100) / 100;
                        const breakB = pm.target;
                        const breakC = breakB + pm.dur;
                        systemRemarks.push(`พัก ${pm.dur} นาที กม.${breakA} เวลา ${formatTime24h(breakB)}-${formatTime24h(breakC)}`);
                    }
                });
                // --------------------------

                let finalRemark = "";
                let sysText = systemRemarks.join('\n');
                
                if (sysText && remarkText) {
                    finalRemark = sysText + '\n' + remarkText;
                } else if (sysText) {
                    finalRemark = sysText;
                } else {
                    finalRemark = remarkText;
                }

                if (index === 0) {
                    finalRemark = "(SP)" + (finalRemark ? " " + finalRemark : "");
                } else if (index === rows.length - 1) {
                    finalRemark = "(RP)" + (finalRemark ? " " + finalRemark : "");
                }
                
                remarkDisplay.textContent = finalRemark;
                // ---------------------------------

                row.querySelector('.acc-dist').textContent = accumulatedDistance.toFixed(2);
                row.querySelector('.travel-time').textContent = Math.round(travelMins);
                
                const arrivalTimeSpan = row.querySelector('.arrival-time');
                const depLabel = row.querySelector('.departure-label');
                depLabel.style.display = 'none'; // We don't use this anymore
                
                arrivalTimeSpan.textContent = formatTime24h(newActual);
                
                if (delayAddedHere > 0) {
                    arrivalTimeSpan.style.color = '#ef4444'; // Red color
                    arrivalTimeSpan.style.fontWeight = 'bold';
                } else {
                    arrivalTimeSpan.style.color = '';
                    arrivalTimeSpan.style.fontWeight = 'normal';
                }
            });
        }

        function printTimetable() {
            const unitName = document.getElementById('unitName').value;
            const routeName = document.getElementById('routeName').value;

            // Build the clean table HTML (with the 3-line print header, no inputs/graphics/buttons)
            let printTableHtml = `
            <div class="print-header" style="text-align: center; margin-bottom: 20px; font-family: 'TH SarabunIT๙', sans-serif;">
                <div style="font-size: 16pt; font-weight: bold; line-height: 1.3;">ตารางนำขบวน</div>
                <div style="font-size: 16pt; line-height: 1.3;">${escapeHtml(unitName)}</div>
                <div style="font-size: 16pt; line-height: 1.3;">${escapeHtml(routeName)}</div>
            </div>
            <table id="scheduleTable">
                <thead>
                    <tr>
                        <th style="width: 5%; text-align: center;">ลำดับ</th>
                        <th style="width: 20%; text-align: left;">ถนน</th>
                        <th style="width: 20%; text-align: left;">จุดตรวจ</th>
                        <th style="width: 10%; text-align: center;">ระยะทาง<br>จุดที่แล้ว</th>
                        <th style="width: 10%; text-align: center;">ระยะทาง<br>จุดเริ่มต้น</th>
                        <th style="width: 10%; text-align: center;">เวลาออก/ถึง</th>
                        <th style="width: 25%; text-align: left;">หมายเหตุ</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            const rows = document.querySelectorAll('#tableBody tr');
            rows.forEach((row, index) => {
                const road = row.querySelector('.road-input').value;
                const checkpoint = row.querySelector('.checkpoint-input').value;
                const distance = row.querySelector('.distance-input').value;
                const accDist = row.querySelector('.acc-dist').textContent;
                const arrivalTime = row.querySelector('.arrival-time').textContent;
                const remark = row.querySelector('.remark-display').textContent;
                
                printTableHtml += `
                    <tr>
                        <td style="text-align: center;">${index + 1}</td>
                        <td style="text-align: left;">${escapeHtml(road)}</td>
                        <td style="text-align: left;">${escapeHtml(checkpoint)}</td>
                        <td style="text-align: center;">${distance !== '' ? distance : '0'}</td>
                        <td style="text-align: center;">${accDist}</td>
                        <td style="text-align: center;">${arrivalTime}</td>
                        <td style="text-align: left; white-space: pre-wrap;">${escapeHtml(remark)}</td>
                    </tr>
                `;
            });
            
            printTableHtml += `
                </tbody>
            </table>
            `;
            
            function escapeHtml(str) {
                if (!str) return '';
                return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
            }

            // Extract styles
            const styles = Array.from(document.querySelectorAll('style')).map(s => s.innerHTML).join('\n');
            
            // Construct print HTML
            const pSize = 'A4 portrait';
            const vpWidth = 790; // Approx A4 width in px for portrait
            
            const printHtml = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=${vpWidth}, initial-scale=1.0">
    <title>พิมพ์ตารางนำขบวน</title>
    <style>
        ${styles}
        
        @page {
            size: ${pSize};
            margin: 10mm 10mm;
        }
        
        body {
            background: white !important;
            color: black !important;
            width: ${vpWidth}px;
            margin: 0 auto;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-family: 'TH SarabunIT๙', sans-serif !important;
        }
        
        /* Table content: 14pt */
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
        }
        th, td { 
            border: 1px solid black !important; 
            padding: 6px 10px !important; 
            color: black !important;
            font-family: 'TH SarabunIT๙' !important;
            font-size: 14pt !important;
        }
        td { 
            font-weight: normal !important; 
        }
        th { 
            font-weight: bold !important; 
            background: white !important; 
            text-align: center; 
        }
        
        @media print {
            body {
                width: auto;
                padding: 0;
            }
        }
    </style>
</head>
<body>
    ${printTableHtml}
    
    <script>
        window.addEventListener('load', function() {
            var body = document.body;
            var maxW = ${vpWidth};
            var minPt = 6;
            
            function tablesOverflow() {
                var tbls = document.querySelectorAll('table');
                for (var i = 0; i < tbls.length; i++) {
                    if (tbls[i].scrollWidth > maxW + 2) return true;
                }
                return false;
            }
            
            // Auto-fit font-size of table
            var curPx = parseFloat(window.getComputedStyle(body).fontSize) || (14 * 96/72);
            var curPt = curPx * 72 / 96;
            var safetyLimit = 50;
            while (tablesOverflow() && curPt > minPt && safetyLimit-- > 0) {
                curPt -= 0.5;
                body.style.fontSize = curPt + 'pt';
                var elms = document.querySelectorAll('th, td, .calc-value, .time-value, .remark-display, td span');
                elms.forEach(function(el) {
                    el.style.setProperty('font-size', curPt + 'pt', 'important');
                });
            }
            
            // Print after fonts are loaded
            var doPrint = function() {
                window.print();
            };
            
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(function() {
                    setTimeout(doPrint, 300);
                });
            } else {
                setTimeout(doPrint, 1000);
            }
        });
    <\/script>
</body>
</html>`;

            // Open new window and print
            const w = window.open('about:blank', '_blank');
            if (w) {
                w.document.open();
                w.document.write(printHtml);
                w.document.close();
            } else {
                // Fallback for pop-up blocker (iframe method)
                const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const fr = document.createElement('iframe');
                fr.style.cssText = 'position:fixed;left:-9999px;top:0;border:none;width:1px;height:1px';
                document.body.appendChild(fr);
                fr.onload = function() {
                    try {
                        fr.contentWindow.print();
                    } catch(e) {}
                    setTimeout(function() {
                        if (fr.parentNode) fr.parentNode.removeChild(fr);
                        URL.revokeObjectURL(url);
                    }, 5000);
                };
                fr.src = url;
            }
        }
    