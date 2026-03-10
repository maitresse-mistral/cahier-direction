/* ═══ CAHIER DE DIRECTION — APP.JS v3 ═══ */

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const CLASSES_NOMS = ['CP','CE1','CE2','CM1','CM2'];
const FOURNISSEURS_DEFAUT = ['Jocatop','Sadel','Lacoste','O\'Buro','Amazon','Imprimboutique'];
const AESH_NOMS = ['AESH 1','AESH 2','AESH 3','AESH 4','AESH 5','AESH 6'];
const HORAIRES_AESH = ['8h00-8h30','8h30-9h00','9h00-9h30','9h30-10h00','10h00-10h30','10h30-11h00','11h00-11h30','11h30-12h00','13h00-13h30','13h30-14h00','14h00-14h30','14h30-15h00','15h00-15h30','15h30-16h00','16h00-16h30','16h30-17h00'];

let state = {
  meta: { name:'', school:'', year:'2025-2026' },
  data: {}, canvas: {},
  currentSection: 'gen',
  stylusMode: false, currentTool: 'pen',
  fournisseurs: [...FOURNISSEURS_DEFAUT],
};

// ── INIT ──────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('cahier_meta');
  if (saved) {
    state.meta = JSON.parse(saved);
    loadAllData();
    startApp(true);
  }
});

function startApp(fromStorage = false) {
  if (!fromStorage) {
    state.meta.name   = document.getElementById('setup-name').value || 'Directrice';
    state.meta.school = document.getElementById('setup-school').value || 'Mon École';
    state.meta.year   = document.getElementById('setup-year').value;
    localStorage.setItem('cahier_meta', JSON.stringify(state.meta));
  }
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('topbar-info').textContent = `${state.meta.school} — ${state.meta.year}`;
  document.getElementById('sidebar-school').textContent = state.meta.school;
  document.getElementById('sidebar-year').textContent = state.meta.year;
  // Load fournisseurs
  const savedF = getData('meta.fournisseurs');
  if (savedF) state.fournisseurs = savedF;
  buildDynamicSections();
  gotoSection('dashboard');
  startAutoSave();
  setTimeout(tryAutoReconnect, 500); // reconnexion silencieuse OneDrive
  initGCal();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ══════════════════════════════════════
// TABLEAU DE BORD
// ══════════════════════════════════════
function buildDashboard() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  const classNames = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];
  const today = new Date();
  const todayStr = today.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // ── Widget Effectifs ──
  let totalEleves = 0, totalF = 0, totalG = 0, totalBep = 0, totalPai = 0;
  const classeRows = classNames.map((nom, ci) => {
    const eleves = getData(`admin.effectifs.c${ci}`) || [];
    const actifs = eleves.filter(e => e.nom?.trim());
    const f = actifs.filter(e => e.genre === 'f').length;
    const g = actifs.filter(e => e.genre === 'g').length;
    const bep = actifs.filter(e => e.bep).length;
    const pai = actifs.filter(e => e.pai || e.ppre || e.ee).length;
    totalEleves += actifs.length; totalF += f; totalG += g;
    totalBep += bep; totalPai += pai;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:8px;background:#F8FAFF;margin-bottom:4px;font-size:12px">
      <span style="font-weight:900;color:#1E3A5F;min-width:38px;font-size:12px">${nom}</span>
      <span style="color:#64748B;flex:1">${actifs.length} élèves</span>
      <span style="color:#EC4899">👧${f}</span>
      <span style="color:#3B82F6;margin-left:4px">👦${g}</span>
      ${bep ? `<span style="font-size:10px;background:#FEF9C3;color:#92400E;padding:1px 5px;border-radius:8px">BEP ${bep}</span>` : ''}
      ${pai ? `<span style="font-size:10px;background:#FEE2E2;color:#991B1B;padding:1px 5px;border-radius:8px">PAI ${pai}</span>` : ''}
    </div>`;
  }).join('');

  const widgetEffectifs = `
    <div class="dash-card">
      <div class="dash-card-header" style="background:linear-gradient(135deg,#93C5FD,#60A5FA)">
        <span class="dash-card-icon">👨‍🏫</span>
        <div>
          <div class="dash-card-title">Effectifs</div>
          <div class="dash-card-sub">${totalEleves} élèves au total</div>
        </div>
        <button class="dash-goto" onclick="gotoSection('admin')">→</button>
      </div>
      <div class="dash-card-body">
        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div class="dash-stat" style="background:#FDF2F8;color:#DB2777">👧 ${totalF} filles</div>
          <div class="dash-stat" style="background:#EFF6FF;color:#1D4ED8">👦 ${totalG} garçons</div>
          ${totalBep ? `<div class="dash-stat" style="background:#FEF9C3;color:#92400E">BEP ${totalBep}</div>` : ''}
          ${totalPai ? `<div class="dash-stat" style="background:#FEE2E2;color:#991B1B">PAI/EE ${totalPai}</div>` : ''}
        </div>
        ${classeRows}
      </div>
    </div>`;

  // ── Widget To-Do du mois ──
  const moisIdx = today.getMonth();
  const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  // Utiliser le même mapping que l'application
  const todoMap = {7:'rentree',8:'sep',9:'oct',10:'nov',11:'dec',0:'jan',1:'fev',2:'mar',3:'avr',4:'mai',5:'juin',6:'juil'};
  const mk = todoMap[moisIdx] || 'sep';
  const todos = getData(`todo.${mk}.items`) || [];
  const enCours = todos.filter(t => !t.checked);
  const faites  = todos.filter(t => t.checked);
  const pct = todos.length ? Math.round((faites.length / todos.length) * 100) : 0;

  const todoRows = enCours.slice(0, 6).map(t => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:#FFFBEB;margin-bottom:4px">
      <span style="width:8px;height:8px;border-radius:50%;background:#FCD34D;flex-shrink:0"></span>
      <span style="font-size:13px;color:#1E3A5F;flex:1">${t.text || t}</span>
    </div>`).join('');

  const widgetTodo = `
    <div class="dash-card">
      <div class="dash-card-header" style="background:linear-gradient(135deg,#FDE68A,#FCD34D)">
        <span class="dash-card-icon">✅</span>
        <div>
          <div class="dash-card-title" style="color:#1E3A5F">To-Do — ${MOIS[moisIdx]}</div>
          <div class="dash-card-sub" style="color:#78350F">${faites.length}/${todos.length} tâches accomplies</div>
        </div>
        <button class="dash-goto" onclick="gotoSection('todo')" style="color:#78350F;border-color:#FCD34D">→</button>
      </div>
      <div class="dash-card-body">
        <div style="background:#F1F5F9;border-radius:20px;height:8px;margin-bottom:12px;overflow:hidden">
          <div style="background:linear-gradient(90deg,#FCD34D,#F59E0B);height:100%;width:${pct}%;border-radius:20px;transition:width .5s"></div>
        </div>
        ${enCours.length === 0 ? '<div style="text-align:center;padding:12px;color:#22C55E;font-weight:800">🎉 Toutes les tâches accomplies !</div>' : todoRows}
        ${enCours.length > 6 ? `<div style="text-align:center;font-size:12px;color:#94A3B8;margin-top:6px">+ ${enCours.length - 6} autres tâches</div>` : ''}
      </div>
    </div>`;

  // ── Widget Google Agenda ──
  const todayStr2 = today.toISOString().split('T')[0];
  const upcomingEvents = gcalEvents
    .filter(ev => ev.start >= todayStr2)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);

  const evRows = upcomingEvents.map(ev => {
    const d = new Date(ev.start + 'T12:00:00');
    const dStr = d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;background:#F0FDF4;margin-bottom:4px">
      <div style="background:${ev.color||'#34A853'};color:white;border-radius:8px;padding:4px 8px;font-size:11px;font-weight:800;min-width:50px;text-align:center">${dStr}</div>
      <span style="font-size:13px;color:#1E3A5F;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ev.title||''}</span>
    </div>`;
  }).join('');

  const widgetAgenda = `
    <div class="dash-card">
      <div class="dash-card-header" style="background:linear-gradient(135deg,#34A853,#4285F4)">
        <span class="dash-card-icon">📅</span>
        <div>
          <div class="dash-card-title">Google Agenda</div>
          <div class="dash-card-sub">${upcomingEvents.length} événement(s) à venir</div>
        </div>
        <button class="dash-goto" onclick="openGCalConfig()">→</button>
      </div>
      <div class="dash-card-body">
        ${upcomingEvents.length === 0
          ? `<div style="text-align:center;padding:16px;color:#94A3B8;font-size:13px">
              ${gcalEvents.length === 0 ? '📅 Synchronisez Google Agenda pour voir vos événements' : '✅ Aucun événement à venir'}
             </div>`
          : evRows}
      </div>
    </div>`;

  // ── Widget Prochaine réunion ──
  let nextReunion = null;
  for (let n = 1; n <= 15; n++) {
    const label = getData(`reunions.r${n}.label`) || `Réunion ${n}`;
    const date  = getData(`reunions.r${n}.date`) || '';
    if (date) {
      const d = new Date(date);
      if (d >= today) {
        if (!nextReunion || d < new Date(nextReunion.date)) {
          nextReunion = { label, date, n };
        }
      }
    }
  }
  const reunionContent = nextReunion
    ? `<div style="text-align:center;padding:12px 0">
        <div style="font-size:13px;color:#64748B;margin-bottom:6px">Prochaine réunion</div>
        <div style="font-size:16px;font-weight:900;color:#1E3A5F;margin-bottom:6px">${nextReunion.label}</div>
        <div style="background:#F0FDF4;border:2px solid #BBF7D0;border-radius:12px;padding:10px;display:inline-block">
          <span style="font-size:20px;font-weight:900;color:#166534">
            ${new Date(nextReunion.date).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
          </span>
        </div>
        <div style="margin-top:10px">
          ${getDaysUntil(nextReunion.date)}
        </div>
      </div>`
    : `<div style="text-align:center;padding:16px;color:#94A3B8;font-size:13px">Aucune réunion planifiée<br><span style="font-size:11px">Ajoutez une date dans la section Réunions</span></div>`;

  const widgetReunion = `
    <div class="dash-card">
      <div class="dash-card-header" style="background:linear-gradient(135deg,#A7F3D0,#34D399)">
        <span class="dash-card-icon">🤝</span>
        <div>
          <div class="dash-card-title" style="color:#1E3A5F">Prochaine réunion</div>
          <div class="dash-card-sub" style="color:#065F46">${nextReunion ? nextReunion.label : 'Aucune planifiée'}</div>
        </div>
        <button class="dash-goto" onclick="gotoSection('reunions')" style="color:#065F46;border-color:#34D399">→</button>
      </div>
      <div class="dash-card-body">${reunionContent}</div>
    </div>`;

  // ── En-tête du tableau de bord ──
  const header = `
    <div style="grid-column:1/-1;background:linear-gradient(135deg,#C4B5FD,#8B5CF6);border-radius:16px;padding:20px 24px;color:white;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:22px;font-weight:900;font-family:'Nunito',sans-serif">Bonjour ${state.meta.name ? state.meta.name.split(' ').pop() : ''} 👋</div>
        <div style="font-size:13px;opacity:.85;margin-top:2px;text-transform:capitalize">${todayStr}</div>
      </div>
      <div style="background:rgba(255,255,255,.2);border-radius:12px;padding:10px 16px;text-align:center">
        <div style="font-size:24px;font-weight:900">${totalEleves}</div>
        <div style="font-size:11px;opacity:.85">élèves</div>
      </div>
    </div>`;

  container.innerHTML = header + widgetEffectifs + widgetTodo + widgetAgenda + widgetReunion;
}

function getDaysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return `<span style="background:#FEF9C3;color:#92400E;padding:4px 12px;border-radius:20px;font-weight:800;font-size:13px">⚡ Aujourd'hui !</span>`;
  if (diff === 1) return `<span style="background:#FEE2E2;color:#991B1B;padding:4px 12px;border-radius:20px;font-weight:800;font-size:13px">⚠️ Demain !</span>`;
  if (diff <= 7)  return `<span style="background:#FEF3C7;color:#92400E;padding:4px 12px;border-radius:20px;font-weight:800;font-size:13px">Dans ${diff} jours</span>`;
  return `<span style="background:#F0FDF4;color:#166534;padding:4px 12px;border-radius:20px;font-weight:800;font-size:13px">Dans ${diff} jours</span>`;
}


function gotoSection(key) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.section === key);
    if (n.dataset.section === key) n.style.setProperty('--c', getColor(key));
  });
  const sec = document.getElementById(`sec-${key}`);
  if (sec) sec.classList.remove('hidden');
  state.currentSection = key;
  if (window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');

  // Trigger active tab content load
  setTimeout(() => {
    loadFormData();
    initCanvases();
    if (key === 'dashboard') buildDashboard();
  if (key === 'calend') showCalend('annuel');
    if (key === 'todo')   showTodo('rentree');
    if (key === 'reunions') showReunion(1);
  }, 50);
}

function getColor(k) {
  return {dashboard:'#C4B5FD',gen:'#F9A8D4',admin:'#93C5FD',ebp:'#FDA4AF',calend:'#FCD34D',todo:'#FDE68A',reunions:'#A7F3D0',classe:'#FBCFE8'}[k]||'#E2E8F0';
}

function showTab(section, tab) {
  const sec = document.getElementById(`sec-${section}`);
  sec.querySelectorAll('.tab-content').forEach(t => { t.classList.add('hidden'); t.classList.remove('active'); });
  const t = document.getElementById(`${section}-${tab}`);
  if (t) { t.classList.remove('hidden'); t.classList.add('active'); }
  sec.querySelectorAll('.subtab').forEach(b => b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${tab}'`)));
  loadFormData(); initCanvases();
  // Lazy build for special tabs
  if (section === 'ebp' && tab === 'aesh') buildAeshEdt();
  if (section === 'classe' && tab === 'anniv') buildAnnivCalendar();
  if (section === 'classe' && tab === 'releves') initReleves();
  if (section === 'admin' && tab === 'commandes') loadCommandeData(cmdCurrentYear);
  if (section === 'admin' && tab === 'effectifs') reloadEffectifsClasses();
  if (section === 'admin' && tab === 'docs') loadAdminDocs();
  if (section === 'classe' && tab === 'docsadm') buildDocsAdmTable();
  if (section === 'ebp' && tab === 'registre') loadEbpRows();
  if (section === 'ebp' && tab === 'soins') loadEbpSoinsRows();
  if (section === 'classe' && tab === 'autosorties') loadAutosortiesRows();
  if (section === 'classe' && tab === 'coop') loadCoopData();
  if (section === 'admin' && tab === 'indicateurs') buildIndicateurs();
  if (section === 'gen' && tab === 'identifiants') loadIdentifiants();
  // Reload editable tables when navigating to their tab
  const editableMap = {
    'gen-identites': true, 'gen-contacts': true,
    'gen-intervenants': true, 'gen-sorties': true,
    'classe-sorties': true,
  };
  if (editableMap[`${section}-${tab}`]) {
    const table = document.querySelector(`#${section}-${tab} .editable-table`);
    if (table) {
      const tbody = table.querySelector('tbody');
      if (!tbody || tbody.children.length === 0) {
        const key = table.dataset.key; const rows = getData(key)||[];
        if(rows.length===0){for(let i=0;i<3;i++) addRowToTable(table);}
        else rows.forEach(r=>addRowToTable(table,r));
      }
    }
  }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ── BUILD ALL ─────────────────────────
function buildDynamicSections() {
  buildFournisseursTags();
  buildCommandesYears();
  buildEffectifsClasses();
  buildCalendriers();
  buildTodoMensuelle();
  buildReunions();
  buildAeshSubtabs();
  loadAdminDocs();
  buildDocsAdmTable();
  loadEbpRows();
  loadEbpSoinsRows();
  loadAutosortiesRows();
  loadCoopData();
  buildReleves();
  buildRdvGrid();
  buildEditorTables();
  loadNotes();
}

// ══════════════════════════════════════
// FOURNISSEURS
// ══════════════════════════════════════
function buildFournisseursTags() {
  const container = document.getElementById('fournisseurs-tags');
  if (!container) return;
  container.innerHTML = state.fournisseurs.map(f =>
    `<span class="tag">${f}<button class="tag-del" onclick="removeFournisseur('${f}')">×</button></span>`
  ).join('');
  // Refresh all select dropdowns in commandes
  document.querySelectorAll('.fourn-select').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = `<option value="">— Fournisseur —</option>` +
      state.fournisseurs.map(f => `<option value="${f}" ${f===cur?'selected':''}>${f}</option>`).join('') +
      `<option value="__autre__">Autre...</option>`;
  });
}

function addFournisseur() {
  const inp = document.getElementById('new-fournisseur-input');
  const val = inp.value.trim();
  if (val && !state.fournisseurs.includes(val)) {
    state.fournisseurs.push(val);
    setData('meta.fournisseurs', state.fournisseurs);
    buildFournisseursTags();
    inp.value = '';
    debounceSave();
    showToast(`✅ "${val}" ajouté !`);
  }
}

function removeFournisseur(f) {
  state.fournisseurs = state.fournisseurs.filter(x => x !== f);
  setData('meta.fournisseurs', state.fournisseurs);
  buildFournisseursTags();
  debounceSave();
}


// ══════════════════════════════════════
// COMMANDES MULTI-ANNÉES
// ══════════════════════════════════════
let cmdCurrentYear = '';

function buildCommandesYears() {
  let years = getData('admin.commandes.years') || [];
  if (years.length === 0) {
    years = [state.meta.year || '2025-2026'];
    setData('admin.commandes.years', years);
  }
  cmdCurrentYear = years[years.length - 1];
  renderCommandesYearTabs(years);
  buildCommandesClasses(cmdCurrentYear);
}

function renderCommandesYearTabs(years) {
  const tabsEl = document.getElementById('commandes-year-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = years.map(y => `
    <button class="year-tab ${y===cmdCurrentYear?'active':''}" onclick="switchCommandesYear('${y}')">
      ${y}<span class="del-year" onclick="event.stopPropagation();deleteCommandesYear('${y}')">×</span>
    </button>`).join('');
}

function switchCommandesYear(year) {
  cmdCurrentYear = year;
  renderCommandesYearTabs(getData('admin.commandes.years') || []);
  buildCommandesClasses(year);
}

function addCommandesYear() {
  const years = getData('admin.commandes.years') || [];
  const last = years[years.length-1] || state.meta.year || '2025-2026';
  const parts = last.split('-');
  const suggested = parts.length===2 ? `${+parts[0]+1}-${+parts[1]+1}` : `${new Date().getFullYear()}-${new Date().getFullYear()+1}`;
  const newYear = prompt('Nom de la nouvelle année scolaire :', suggested);
  if (!newYear || years.includes(newYear)) return;
  years.push(newYear);
  setData('admin.commandes.years', years);
  debounceSave();
  switchCommandesYear(newYear);
}

function deleteCommandesYear(year) {
  if (!confirm(`Supprimer l'année "${year}" et toutes ses commandes ?`)) return;
  let years = (getData('admin.commandes.years') || []).filter(y => y !== year);
  if (!years.length) years = [state.meta.year || '2025-2026'];
  setData('admin.commandes.years', years);
  debounceSave();
  switchCommandesYear(years[years.length-1]);
}

function buildCommandesClasses(year) {
  const tabsEl = document.getElementById('commandes-class-tabs');
  const contentEl = document.getElementById('commandes-class-content');
  if (!tabsEl || !contentEl) return;
  const classNames = getData('admin.effectifs.classnames') || CLASSES_NOMS;
  tabsEl.innerHTML = classNames.map((c,i) =>
    `<button class="class-tab ${i===0?'active':''}" onclick="showCommandeClass(${i})">${c}</button>`
  ).join('');
  contentEl.innerHTML = classNames.map((c,i) => `
    <div class="class-panel ${i===0?'active':''}" id="cmd-panel-${i}">
      <div class="budget-class-bar">
        <span class="label-sm">Classe : <strong>${c}</strong></span>
        <span class="label-sm" style="margin-left:16px">💰 Budget alloué :</span>
        <input type="number" class="budget-input" id="cmd-budget-${i}" placeholder="0.00" step="0.01" min="0" oninput="calcCommandeClass(${i})">
        <span class="label-sm">€</span>
        <div class="budget-badge" id="cmd-remaining-${i}">Dépensé : 0 € / Reste : — €</div>
      </div>
      <div class="table-wrap"><table class="data-table" id="cmd-table-${i}">
        <thead><tr>
          <th style="width:40px">N°</th><th style="width:120px">Date</th>
          <th>Fournisseur</th><th style="width:110px">Total TTC (€)</th>
          <th style="width:80px">Livré</th><th>Notes</th>
          <th class="no-print"><button class="add-row-btn" onclick="addCmdRow(${i})">+</button></th>
        </tr></thead>
        <tbody id="cmd-body-${i}"></tbody>
        <tfoot>
          <tr class="total-row"><td colspan="3">TOTAL TTC :</td><td id="cmd-ttc-${i}" class="total-cell">0.00 €</td><td colspan="3"></td></tr>
        </tfoot>
      </table></div>
    </div>`).join('');
  loadCommandeData(year);
}

function addCmdRow(ci, data=null) {
  const body = document.getElementById(`cmd-body-${ci}`);
  if (!body) return;
  const n = body.querySelectorAll('tr').length + 1;
  const tr = document.createElement('tr');
  const fopts = `<option value="">— Choisir —</option>` +
    state.fournisseurs.map(f => `<option value="${f}" ${data&&data[2]===f?'selected':''}>${f}</option>`).join('') +
    `<option value="__autre__">Autre...</option>`;
  // data format: [n°, date, fournisseur, ttc, livré, notes]
  tr.innerHTML = `
    <td><input type="text" value="${data?data[0]:n}" style="width:36px;text-align:center"></td>
    <td><input type="date" value="${data?data[1]:''}"></td>
    <td><select class="fourn-select" onchange="handleFourniChange(this,${ci})">${fopts}</select></td>
    <td><input type="number" value="${data?data[3]:''}" min="0" step="0.01" oninput="calcCommandeClass(${ci})" style="width:100px;font-weight:700"></td>
    <td><select onchange="saveCmdData(${ci})">
      <option value="">—</option>
      <option value="oui" ${data&&data[4]==='oui'?'selected':''}>✓ Oui</option>
      <option value="non" ${data&&data[4]==='non'?'selected':''}>✗ Non</option>
      <option value="partiel" ${data&&data[4]==='partiel'?'selected':''}>~ Partiel</option>
    </select></td>
    <td><input type="text" value="${data?data[5]:''}" placeholder="Notes…"></td>
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();calcCommandeClass(${ci})">×</button></td>
  `;
  body.appendChild(tr);
  tr.querySelectorAll('input,select').forEach(el => el.addEventListener('change', () => saveCmdData(ci)));
}

function handleFourniChange(sel, ci) {
  if (sel.value === '__autre__') {
    const val = prompt('Nom du fournisseur :');
    if (val && !state.fournisseurs.includes(val)) {
      state.fournisseurs.push(val);
      setData('meta.fournisseurs', state.fournisseurs);
      buildFournisseursTags();
      debounceSave();
    }
    sel.value = val || '';
  }
  saveCmdData(ci);
}

function calcCommandeClass(ci) {
  const rows = document.querySelectorAll(`#cmd-body-${ci} tr`);
  let totalTTC = 0;
  rows.forEach(tr => {
    const ttcInput = tr.querySelectorAll('input[type=number]')[0];
    totalTTC += parseFloat(ttcInput?.value) || 0;
  });
  const ttcEl = document.getElementById(`cmd-ttc-${ci}`);
  const remEl = document.getElementById(`cmd-remaining-${ci}`);
  const budEl = document.getElementById(`cmd-budget-${ci}`);
  if (ttcEl) ttcEl.textContent = totalTTC.toFixed(2) + ' €';
  if (remEl && budEl) {
    const budget = parseFloat(budEl.value) || 0;
    const reste  = budget - totalTTC;
    remEl.textContent = `Dépensé : ${totalTTC.toFixed(2)} € / Reste : ${reste.toFixed(2)} €`;
    remEl.className = 'budget-badge' + (reste < 0 ? ' negative' : '');
  }
  saveCmdData(ci);
}

function showCommandeClass(i) {
  document.querySelectorAll('.class-tab').forEach((t,j) => t.classList.toggle('active', i===j));
  document.querySelectorAll('.class-panel').forEach((p,j) => p.classList.toggle('active', i===j));
}

function saveCmdData(ci) {
  const budget = document.getElementById(`cmd-budget-${ci}`)?.value || '0';
  const rows = [...document.querySelectorAll(`#cmd-body-${ci} tr`)].map(tr =>
    [...tr.querySelectorAll('td')].slice(0,-1).map(td => { const inp = td.querySelector('input,select'); return inp?inp.value:''; })
  );
  setData(`admin.commandes.${cmdCurrentYear}.c${ci}`, { budget, rows });
  debounceSave();
}

function loadCommandeData(year) {
  const classNames = getData('admin.effectifs.classnames') || CLASSES_NOMS;
  classNames.forEach((_,ci) => {
    const saved = getData(`admin.commandes.${year}.c${ci}`) || getData(`admin.commandes.c${ci}`);
    const body = document.getElementById(`cmd-body-${ci}`);
    const budEl = document.getElementById(`cmd-budget-${ci}`);
    if (!body) return;
    body.innerHTML = '';
    if (saved) { if (budEl) budEl.value = saved.budget||''; (saved.rows||[]).forEach(r => addCmdRow(ci,r)); }
    else { for(let i=0;i<3;i++) addCmdRow(ci); }
    calcCommandeClass(ci);
  });
}


// ══ ADMIN DOCS — colonnes dynamiques ══
function getAdminDocsCols() {
  const head = document.getElementById('admin-docs-head');
  if (!head) return [];
  return [...head.querySelectorAll('th.th-rot span')].map(s => s.textContent.trim());
}

function saveAdminDocsCols() {
  const cols = getAdminDocsCols();
  setData('admin.docs.cols', cols);
  debounceSave();
}

function addAdminDocsCol() {
  const head = document.getElementById('admin-docs-head');
  if (!head) return;
  const lastTh = head.querySelector('th.no-print');
  const th = document.createElement('th');
  th.className = 'th-rot';
  th.innerHTML = `<span contenteditable="true" onblur="saveAdminDocsCols()">Nouveau doc</span>
    <button class="delete-row-btn" style="position:absolute;top:2px;right:2px;font-size:10px" onclick="removeAdminDocsCol(this)" title="Supprimer colonne">×</button>`;
  th.style.position = 'relative';
  head.insertBefore(th, lastTh);
  // Add cell to all rows
  document.querySelectorAll('#admin-docs-body tr').forEach(tr => {
    const delTd = tr.lastElementChild;
    const td = document.createElement('td');
    td.style.textAlign = 'center';
    td.innerHTML = `<input type="checkbox" onchange="saveAdminDocsRows()">`;
    tr.insertBefore(td, delTd);
  });
  saveAdminDocsCols();
}

function removeAdminDocsCol(btn) {
  const th = btn.closest('th');
  const head = document.getElementById('admin-docs-head');
  const ths = [...head.querySelectorAll('th')];
  const colIdx = ths.indexOf(th);
  if (colIdx < 0) return;
  th.remove();
  document.querySelectorAll('#admin-docs-body tr').forEach(tr => {
    const tds = [...tr.querySelectorAll('td')];
    if (tds[colIdx]) tds[colIdx].remove();
  });
  saveAdminDocsCols();
  saveAdminDocsRows();
}

function addAdminDocsRow(name='') {
  const body = document.getElementById('admin-docs-body');
  const head = document.getElementById('admin-docs-head');
  if (!body || !head) return;
  const nCols = head.querySelectorAll('th.th-rot').length;
  const tr = document.createElement('tr');
  let cells = `<td><input type="text" value="${name}" placeholder="Enseignant…" style="min-width:120px;padding:8px 10px;border:none;font-weight:700" onchange="saveAdminDocsRows()"></td>`;
  for (let i = 0; i < nCols; i++) {
    cells += `<td style="text-align:center"><input type="checkbox" onchange="saveAdminDocsRows()"></td>`;
  }
  cells += `<td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveAdminDocsRows()">×</button></td>`;
  tr.innerHTML = cells;
  body.appendChild(tr);
}

function saveAdminDocsRows() {
  const rows = [...document.querySelectorAll('#admin-docs-body tr')].map(tr => {
    const name = tr.querySelector('input[type=text]')?.value || '';
    const checks = [...tr.querySelectorAll('input[type=checkbox]')].map(c => c.checked);
    return { name, checks };
  });
  setData('admin.docs.rows', rows);
  debounceSave();
}

function loadAdminDocs() {
  const body = document.getElementById('admin-docs-body');
  const head = document.getElementById('admin-docs-head');
  if (!body || !head || body.children.length > 0) return;

  // Restore saved column names
  const savedCols = getData('admin.docs.cols');
  if (savedCols && savedCols.length > 0) {
    // Remove existing th-rot, rebuild from saved
    head.querySelectorAll('th.th-rot').forEach(th => th.remove());
    const lastTh = head.querySelector('th.no-print');
    savedCols.forEach(col => {
      const th = document.createElement('th');
      th.className = 'th-rot';
      th.innerHTML = `<span contenteditable="true" onblur="saveAdminDocsCols()">${col}</span>`;
      head.insertBefore(th, lastTh);
    });
  }

  // Restore rows
  const saved = getData('admin.docs.rows') || getData('admin.docs') || [];
  if (saved.length === 0) {
    for (let i = 0; i < 3; i++) addAdminDocsRow();
  } else {
    saved.forEach(row => {
      addAdminDocsRow(row.name || '');
      const tr = body.lastElementChild;
      const checks = tr.querySelectorAll('input[type=checkbox]');
      (row.checks || []).forEach((v, i) => { if (checks[i]) checks[i].checked = v; });
    });
  }
}


// ══════════════════════════════════════
function addCheckboxRow(bodyId, dataKey, preloadName='') {
  const body = document.getElementById(bodyId);
  if (!body) return;
  const ncols = 9; // number of checkbox cols
  const id = Date.now() + Math.random();
  const tr = document.createElement('tr');
  tr.dataset.rowid = id;
  let cells = `<td><input type="text" value="${preloadName}" placeholder="Nom…" style="min-width:120px;padding:8px 10px;border:none;font-weight:700"
    onchange="saveCheckboxRows('${bodyId}','${dataKey}')"></td>`;
  for (let i = 0; i < ncols; i++) {
    cells += `<td style="text-align:center"><input type="checkbox" onchange="saveCheckboxRows('${bodyId}','${dataKey}')"></td>`;
  }
  cells += `<td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveCheckboxRows('${bodyId}','${dataKey}')">×</button></td>`;
  tr.innerHTML = cells;
  body.appendChild(tr);
}

function saveCheckboxRows(bodyId, dataKey) {
  const rows = [...document.querySelectorAll(`#${bodyId} tr`)].map(tr => {
    const nameEl = tr.querySelector('input[type=text]');
    const checks = [...tr.querySelectorAll('input[type=checkbox]')].map(c => c.checked);
    return { name: nameEl?.value || '', checks };
  });
  setData(dataKey, rows);
  debounceSave();
}

function loadCheckboxRows(bodyId, dataKey, ncols) {
  const body = document.getElementById(bodyId);
  if (!body || body.querySelectorAll('tr').length > 0) return;
  const saved = getData(dataKey) || [];
  if (saved.length === 0) {
    for (let i = 0; i < 3; i++) addCheckboxRow(bodyId, dataKey);
  } else {
    saved.forEach(row => {
      addCheckboxRow(bodyId, dataKey, row.name);
      const tr = body.lastElementChild;
      const checks = tr.querySelectorAll('input[type=checkbox]');
      (row.checks || []).forEach((v, i) => { if (checks[i]) checks[i].checked = v; });
    });
  }
}

// ══════════════════════════════════════
// EFFECTIFS — 5 CLASSES AVEC NOMS MODIFIABLES
// ══════════════════════════════════════
function buildEffectifsClasses() {
  const tabsEl = document.getElementById('effectifs-class-tabs');
  const contentEl = document.getElementById('effectifs-class-content');
  if (!tabsEl || !contentEl) return;
  // Don't rebuild if already built — prevents data loss on navigation
  if (contentEl.innerHTML.trim()) return;

  const defaultNames = ['CP','CE1','CE2','CM1','CM2'];
  const savedNames = getData('admin.effectifs.classnames') || defaultNames;

  tabsEl.innerHTML = savedNames.map((c,i) =>
    `<button class="class-tab ${i===0?'active':''}" onclick="showEffectifsClass(${i})">${c}</button>`
  ).join('');

  contentEl.innerHTML = savedNames.map((c,i) => `
    <div class="effectifs-class-panel ${i===0?'active':''}" id="effectifs-panel-${i}">
      <div class="effectifs-class-header">
        <input class="effectifs-class-name-input" type="text" value="${c}"
          placeholder="Nom de la classe…" title="Cliquez pour renommer"
          onchange="renameEffectifsClass(${i}, this.value)"
          oninput="document.querySelectorAll('.class-tab')[${i}].textContent=this.value">
        <div class="effectifs-stats">
          <div class="effectifs-stat">Total : <span id="eff-total-${i}">0</span></div>
          <div class="effectifs-stat">Filles : <span id="eff-filles-${i}">0</span></div>
          <div class="effectifs-stat">Garçons : <span id="eff-garcons-${i}">0</span></div>
          <div class="effectifs-stat">BEP : <span id="eff-bep-${i}">0</span></div>
        </div>
      </div>
      <div class="import-bar">
        <span class="label-sm">📥 Importer liste élèves (Excel/CSV) :</span>
        <input type="file" id="eff-excel-${i}" accept=".xlsx,.xls,.csv" style="display:none"
          onchange="importExcelToEffectifs(this,${i})">
        <button class="btn-xs" onclick="document.getElementById('eff-excel-${i}').click()">📂 Fichier Excel</button>
        <button class="btn-xs" onclick="addEffectifsRow(${i})">+ Ajouter élève</button>
        <button class="btn-xs" onclick="clearEffectifsClass(${i})" style="margin-left:auto;color:#EF4444">🗑️ Vider</button>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="effectifs-table-${i}">
          <thead><tr>
            <th>Nom &amp; Prénom</th><th>Date naissance</th><th>Filles</th><th>Garçons</th>
            <th>Niveau</th>
            <th class="th-rot"><span>BEP</span></th>
            <th class="th-rot"><span>PAI</span></th>
            <th class="th-rot"><span>PPRE</span></th>
            <th class="th-rot"><span>EE</span></th>
            <th class="th-rot"><span>AESH</span></th>
            <th>Notes</th>
            <th class="no-print"></th>
          </tr></thead>
          <tbody id="effectifs-body-${i}"></tbody>
        </table>
      </div>

      <!-- RÉPARTITION EN GROUPES -->
      <div class="groupes-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h4>🔀 Répartition en groupes / ateliers</h4>
          <button class="btn-xs" onclick="addGroupe(${i})">+ Nouveau groupe</button>
        </div>
        <p class="hint" style="margin-bottom:10px">Saisissez les noms des élèves dans chaque groupe. Renommez les groupes en cliquant sur leur titre.</p>
        <div class="groupes-grid" id="groupes-grid-${i}"></div>
      </div>
    </div>
  `).join('');

  // Load data for all classes
  for (let i = 0; i < 5; i++) { loadEffectifsClass(i); loadGroupes(i); }
}

function reloadEffectifsClasses() {
  // Si déjà construit, recharge juste les données sans tout recréer
  const contentEl = document.getElementById('effectifs-class-content');
  if (!contentEl || !contentEl.innerHTML.trim()) {
    buildEffectifsClasses();
    return;
  }
  // Reload each class data
  for (let i = 0; i < 5; i++) {
    const body = document.getElementById(`effectifs-body-${i}`);
    if (!body) continue;
    if (body.children.length === 0) {
      loadEffectifsClass(i);
      loadGroupes(i);
    }
  }
}

function showEffectifsClass(i) {
  document.querySelectorAll('#effectifs-class-tabs .class-tab').forEach((t,j) => t.classList.toggle('active', i===j));
  document.querySelectorAll('.effectifs-class-panel').forEach((p,j) => p.classList.toggle('active', i===j));
}

function renameEffectifsClass(i, newName) {
  const names = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];
  names[i] = newName;
  setData('admin.effectifs.classnames', names);
  // Update tab label
  const tabs = document.querySelectorAll('#effectifs-class-tabs .class-tab');
  if (tabs[i]) tabs[i].textContent = newName;
  debounceSave();
}

function niveauPickerHTML(val, ci, nCol) {
  const niveaux = ['CP','CE1','CE2','CM1','CM2'];
  return `<td><div class="niveau-picker" data-ncol="${nCol}">` +
    niveaux.map(n =>
      `<button type="button" class="niveau-btn${val===n?' active':''}" data-niveau="${n}"
        onclick="toggleNiveau(this,${ci})">${n}</button>`
    ).join('') +
  `</div></td>`;
}

function toggleNiveau(btn, ci) {
  const picker = btn.closest('.niveau-picker');
  // Deselect if already active, else select
  const wasActive = btn.classList.contains('active');
  picker.querySelectorAll('.niveau-btn').forEach(b => b.classList.remove('active'));
  if (!wasActive) btn.classList.add('active');
  saveEffectifsClass(ci);
}

function addEffectifsRow(ci, data=null) {
  const body = document.getElementById(`effectifs-body-${ci}`);
  if (!body) return;
  const d = data || {};
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="${d.nom||''}" placeholder="Nom Prénom…" style="min-width:150px;border:none;padding:8px 10px;font-weight:600" oninput="calcEffectifsTotals(${ci})"></td>
    <td><input type="date" value="${d.ddn||''}" style="border:none;padding:6px 4px;font-size:12px" onchange="saveEffectifsClass(${ci})"></td>
    <td style="text-align:center"><input type="radio" name="genre-${Date.now()}" value="f" ${d.genre==='f'?'checked':''} onchange="calcEffectifsTotals(${ci})"></td>
    <td style="text-align:center"><input type="radio" name="genre-${Date.now()}" value="g" ${d.genre==='g'?'checked':''} onchange="calcEffectifsTotals(${ci})"></td>
    ${niveauPickerHTML(d.niv1||'', ci, 0)}
    <td style="text-align:center"><input type="checkbox" ${d.bep?'checked':''} onchange="saveEffectifsClass(${ci});calcEffectifsTotals(${ci})"></td>
    <td style="text-align:center"><input type="checkbox" ${d.pai?'checked':''} onchange="saveEffectifsClass(${ci})"></td>
    <td style="text-align:center"><input type="checkbox" ${d.ppre?'checked':''} onchange="saveEffectifsClass(${ci})"></td>
    <td style="text-align:center"><input type="checkbox" ${d.ee?'checked':''} onchange="saveEffectifsClass(${ci})"></td>
    <td style="text-align:center"><input type="checkbox" ${d.aesh?'checked':''} onchange="saveEffectifsClass(${ci})"></td>
    <td><input type="text" value="${d.notes||''}" placeholder="Notes…" style="border:none;padding:8px 10px" oninput="saveEffectifsClass(${ci})"></td>
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveEffectifsClass(${ci});calcEffectifsTotals(${ci})">×</button></td>
  `;
  body.appendChild(tr);
  const radios = tr.querySelectorAll('input[type=radio]');
  const uid = `genre-r${ci}-${body.children.length}`;
  radios.forEach(r => { r.name = uid; r.addEventListener('change', () => { saveEffectifsClass(ci); calcEffectifsTotals(ci); }); });
  calcEffectifsTotals(ci);
}

function calcEffectifsTotals(ci) {
  const body = document.getElementById(`effectifs-body-${ci}`);
  if (!body) return;
  let total = 0, filles = 0, garcons = 0, bep = 0;
  body.querySelectorAll('tr').forEach(tr => {
    const nom = tr.querySelector('input[type=text]')?.value?.trim();
    if (!nom) return;
    total++;
    const genre = tr.querySelector('input[value=f]')?.checked ? 'f' : tr.querySelector('input[value=g]')?.checked ? 'g' : '';
    if (genre === 'f') filles++;
    else if (genre === 'g') garcons++;
    const checks = tr.querySelectorAll('input[type=checkbox]');
    if (checks[0]?.checked) bep++;
  });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set(`eff-total-${ci}`, total);
  set(`eff-filles-${ci}`, filles);
  set(`eff-garcons-${ci}`, garcons);
  set(`eff-bep-${ci}`, bep);
  saveEffectifsClass(ci);
}

function saveEffectifsClass(ci) {
  const body = document.getElementById(`effectifs-body-${ci}`);
  if (!body) return;
  const rows = [...body.querySelectorAll('tr')].map(tr => {
    const texts = tr.querySelectorAll('input[type=text]');
    const dates = tr.querySelectorAll('input[type=date]');
    const checks = tr.querySelectorAll('input[type=checkbox]');
    const genre = tr.querySelector('input[value=f]')?.checked ? 'f' : tr.querySelector('input[value=g]')?.checked ? 'g' : '';
    const pickers = tr.querySelectorAll('.niveau-picker');
    const getNiv = (p) => p?.querySelector('.niveau-btn.active')?.dataset.niveau || '';
    return {
      nom: texts[0]?.value||'', ddn: dates[0]?.value||'', genre,
      niv1: getNiv(pickers[0]),
      bep:checks[0]?.checked, pai:checks[1]?.checked, ppre:checks[2]?.checked,
      ee:checks[3]?.checked, aesh:checks[4]?.checked, notes:texts[1]?.value||''
    };
  });
  setData(`admin.effectifs.c${ci}`, rows);
  syncEffectifsToEbp();
  debounceSave();
}

// ══ SYNC EFFECTIFS → EBP REGISTRE ══
// Parcourt toutes les classes, tous les élèves ayant PAI/PPRE/EE/AESH coché
// et les ajoute/met à jour dans le registre EBP (sans écraser les données existantes)
function syncEffectifsToEbp() {
  const classNames = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];
  const ebpRows = getData('ebp.registre') || [];

  // Index existant : nom normalisé → index dans ebpRows
  const index = {};
  ebpRows.forEach((r, i) => {
    if (r.nom) index[r.nom.trim().toLowerCase()] = i;
  });

  let changed = false;
  for (let ci = 0; ci < 5; ci++) {
    const eleves = getData(`admin.effectifs.c${ci}`) || [];
    eleves.forEach(e => {
      if (!e.nom || !e.nom.trim()) return;
      const hasFlag = e.pai || e.ppre || e.ee || e.aesh || e.bep;
      if (!hasFlag) return; // ne synchronise que les élèves avec au moins un flag

      const key = e.nom.trim().toLowerCase();
      if (index[key] !== undefined) {
        // Élève déjà dans EBP — mettre à jour les cases seulement si elles ne sont pas déjà cochées
        const row = ebpRows[index[key]];
        if (e.pai  && !row.pai)  { row.pai  = true; changed = true; }
        if (e.ppre && !row.ppre) { row.ppre = true; changed = true; }
        if (e.ee   && !row.ee)   { row.ee   = true; changed = true; }
        if (e.aesh && !row.aesh) { row.aesh = true; changed = true; }
        // Mettre à jour la classe si vide
        if (!row.classe && classNames[ci]) { row.classe = classNames[ci]; changed = true; }
      } else {
        // Nouvel élève à ajouter
        const newRow = {
          nom: e.nom.trim(),
          classe: classNames[ci],
          pai:  !!e.pai,
          ess:  false,
          ee:   !!e.ee,
          ppre: !!e.ppre,
          pps:  false,
          aesh: !!e.aesh,
          rev1:'', rev2:'', rev3:'', obs:''
        };
        ebpRows.push(newRow);
        index[key] = ebpRows.length - 1;
        changed = true;
      }
    });
  }

  if (changed) {
    setData('ebp.registre', ebpRows);
    // Recharger le tableau EBP s'il est visible
    const body = document.getElementById('ebp-registre-body');
    if (body && body.closest('.tab-content')?.classList.contains('active')) {
      body.innerHTML = '';
      ebpRows.forEach(r => addEbpRow(r));
    }
    showToast('🔄 Registre EBP mis à jour depuis les effectifs');
  }
}


function loadEffectifsClass(ci) {
  const body = document.getElementById(`effectifs-body-${ci}`);
  if (!body) return;
  const saved = getData(`admin.effectifs.c${ci}`) || [];
  body.innerHTML = '';
  if (saved.length === 0) { for (let i = 0; i < 3; i++) addEffectifsRow(ci); }
  else saved.forEach(r => addEffectifsRow(ci, r));
  calcEffectifsTotals(ci);
}

function clearEffectifsClass(ci) {
  if (!confirm('Vider cette classe ?')) return;
  const body = document.getElementById(`effectifs-body-${ci}`);
  if (body) body.innerHTML = '';
  setData(`admin.effectifs.c${ci}`, []);
  calcEffectifsTotals(ci);
  debounceSave();
}

function importExcelToEffectifs(input, ci) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type:'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const body = document.getElementById(`effectifs-body-${ci}`);
      body.innerHTML = '';
      // Detect header row to find ddn column
      let ddnCol = -1;
      let dataStart = 0;
      if (rows.length > 0) {
        const header = rows[0].map(c => String(c).toLowerCase());
        if (/nom|prénom|élève/.test(header[0])) {
          dataStart = 1;
          ddnCol = header.findIndex(c => /naissance|ddn|né|birth/.test(c));
        }
      }
      rows.slice(dataStart).forEach(row => {
        const nom = [row[0], row[1]].filter(Boolean).join(' ').trim() || String(row[0]);
        if (!nom) return;
        // Parse date de naissance — Excel serial number or string
        let ddn = '';
        if (ddnCol >= 0 && row[ddnCol]) {
          const raw = row[ddnCol];
          if (typeof raw === 'number') {
            // Excel serial date → JS Date (UTC pour éviter décalage fuseau)
            const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
            const y = d.getUTCFullYear(), mo = String(d.getUTCMonth()+1).padStart(2,'0'), dy = String(d.getUTCDate()).padStart(2,'0');
            ddn = `${y}-${mo}-${dy}`;
          } else {
            // Try French DD/MM/YYYY first, then ISO
            const strRaw = String(raw).trim();
            const frMatch = strRaw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
            if (frMatch) {
              ddn = `${frMatch[3]}-${frMatch[2].padStart(2,'0')}-${frMatch[1].padStart(2,'0')}`;
            } else {
              const d = new Date(strRaw);
              if (!isNaN(d)) {
                const y = d.getUTCFullYear(), mo = String(d.getUTCMonth()+1).padStart(2,'0'), dy = String(d.getUTCDate()).padStart(2,'0');
                ddn = `${y}-${mo}-${dy}`;
              } else ddn = strRaw;
            }
          }
        }
        addEffectifsRow(ci, { nom, ddn });
      });
      calcEffectifsTotals(ci);
      showToast(`✅ ${body.children.length} élèves importés !`);
    } catch { showToast('⚠️ Erreur de lecture Excel'); }
  };
  reader.readAsBinaryString(file);
}

// Legacy - keep for compatibility
function addEffectifsRow_old(data=null) {}
function saveEffectifs() {}
function loadEffectifsRows() { buildEffectifsClasses(); }
function importExcelToTable(input) {}

// ══════════════════════════════════════
// EBP — REGISTRE PAI
// ══════════════════════════════════════
// Lit les noms depuis gen.identites pour construire une liste déroulante
function getClasseOptions(selected='') {
  const identites = getData('gen.identites') || [];
  const noms = identites.map(row => Array.isArray(row) ? row[0] : (row.nom || row[0] || '')).filter(Boolean);
  const classNames = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];
  // Combine classe names + teacher names from identités
  const allOpts = [...classNames, ...noms.filter(n => !classNames.includes(n))];
  return `<option value="">—</option>` +
    allOpts.map(n => `<option value="${n}" ${selected===n?'selected':''}>${n}</option>`).join('');
}

function addEbpRow(data=null) {
  const body = document.getElementById('ebp-registre-body');
  if (!body) return;
  const tr = document.createElement('tr');
  const d = data || {};
  const classeOpts = getClasseOptions(d.classe||'');
  tr.innerHTML = `
    <td><input type="text" value="${d.nom||''}" placeholder="Nom Prénom…" style="min-width:130px;padding:8px 10px;border:none;font-weight:600" onchange="saveEbpRows()"></td>
    <td><select style="border:none;padding:6px 4px;font-family:var(--font);font-size:13px" onchange="saveEbpRows()">${classeOpts}</select></td>
    ${['pai','ess','ee','ppre','pps','aesh'].map(k =>
      `<td style="text-align:center"><input type="checkbox" ${d[k]?'checked':''} onchange="saveEbpRows()"></td>`
    ).join('')}
    <td><input type="date" value="${d.rev1||''}" style="width:120px;border:none;padding:6px" onchange="saveEbpRows()"></td>
    <td><input type="date" value="${d.rev2||''}" style="width:120px;border:none;padding:6px" onchange="saveEbpRows()"></td>
    <td><input type="date" value="${d.rev3||''}" style="width:120px;border:none;padding:6px" onchange="saveEbpRows()"></td>
    <td><input type="text" value="${d.obs||''}" placeholder="Observations…" style="min-width:160px;border:none;padding:8px 10px" onchange="saveEbpRows()"></td>
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveEbpRows()">×</button></td>
  `;
  body.appendChild(tr);
}

function saveEbpRows() {
  const rows = [...document.querySelectorAll('#ebp-registre-body tr')].map(tr => {
    const inputs = tr.querySelectorAll('input[type=text],input[type=date]');
    const checks = tr.querySelectorAll('input[type=checkbox]');
    const sel = tr.querySelector('select');
    return {
      nom: inputs[0]?.value, classe: sel?.value||'',
      pai: checks[0]?.checked, ess: checks[1]?.checked, ee: checks[2]?.checked,
      ppre: checks[3]?.checked, pps: checks[4]?.checked, aesh: checks[5]?.checked,
      rev1: inputs[1]?.value, rev2: inputs[2]?.value, rev3: inputs[3]?.value,
      obs: inputs[4]?.value,
    };
  });
  setData('ebp.registre', rows); debounceSave();
}

function loadEbpRows() {
  const body = document.getElementById('ebp-registre-body');
  if (!body || body.children.length > 0) return;
  const saved = getData('ebp.registre') || [];
  if (saved.length === 0) { for(let i=0;i<3;i++) addEbpRow(); }
  else saved.forEach(r => addEbpRow(r));
}

// EBP SOINS — sorties régulières avec jours de semaine (pas de mercredi)
const JOURS_SOINS = ['Lundi','Mardi','Jeudi','Vendredi'];

function addEbpSoinsRow(data=null) {
  const body = document.getElementById('ebp-soins-body');
  if (!body) return;
  const d = data || {};
  const joursChecked = d.jours || [];
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="${d.nom||''}" placeholder="Nom Prénom…" style="min-width:120px;border:none;padding:8px 10px" onchange="saveEbpSoins()"></td>
    <td><input type="text" value="${d.classe||''}" style="width:55px;border:none;padding:8px 6px" onchange="saveEbpSoins()"></td>
    <td style="min-width:160px">
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 6px">
        ${JOURS_SOINS.map(j => `
          <label style="display:flex;align-items:center;gap:3px;font-size:12px;cursor:pointer;white-space:nowrap">
            <input type="checkbox" ${joursChecked.includes(j)?'checked':''} onchange="saveEbpSoins()" style="accent-color:#FDA4AF">
            ${j}
          </label>`).join('')}
      </div>
    </td>
    <td><input type="time" value="${d.hsortie||''}" style="width:90px;border:none;padding:6px 8px" onchange="saveEbpSoins()"></td>
    <td><input type="time" value="${d.hretour||''}" style="width:90px;border:none;padding:6px 8px" onchange="saveEbpSoins()"></td>
    <td><input type="text" value="${d.motif||''}" placeholder="Motif / Soin…" style="min-width:120px;border:none;padding:8px 10px" onchange="saveEbpSoins()"></td>
    <td><input type="text" value="${d.resp||''}" placeholder="Responsable…" style="min-width:100px;border:none;padding:8px 10px" onchange="saveEbpSoins()"></td>
    <td><input type="text" value="${d.obs||''}" placeholder="Observations…" style="min-width:120px;border:none;padding:8px 10px" onchange="saveEbpSoins()"></td>
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveEbpSoins()">×</button></td>
  `;
  body.appendChild(tr);
}

function saveEbpSoins() {
  const rows = [...document.querySelectorAll('#ebp-soins-body tr')].map(tr => {
    const inputs = tr.querySelectorAll('input[type="text"], input[type="time"]');
    const jours = [...tr.querySelectorAll('input[type="checkbox"]')]
      .filter(c => c.checked).map((c,i) => JOURS_SOINS[i]);
    return { nom:inputs[0]?.value, classe:inputs[1]?.value, jours,
      hsortie:inputs[2]?.value, hretour:inputs[3]?.value,
      motif:inputs[4]?.value, resp:inputs[5]?.value, obs:inputs[6]?.value };
  });
  setData('ebp.soins', rows); debounceSave();
}

function loadEbpSoinsRows() {
  const body = document.getElementById('ebp-soins-body');
  if (!body || body.children.length > 0) return;
  const saved = getData('ebp.soins') || [];
  if (saved.length === 0) { for(let i=0;i<3;i++) addEbpSoinsRow(); }
  else saved.forEach(r => addEbpSoinsRow(r));
}

// ══════════════════════════════════════
// AESH EMPLOIS DU TEMPS
// ══════════════════════════════════════
function buildAeshSubtabs() {
  // Dynamic — built inside buildAeshEdt
}

function buildAeshEdt() {
  const content = document.getElementById('aesh-content');
  if (!content || content.innerHTML.trim()) return;
  // Load saved AESH list (or default 6)
  const aeshList = getData('ebp.aesh.list') || AESH_NOMS.map((n,i) => ({ id: i, nom: n }));
  renderAeshFull(aeshList);
}

function renderAeshFull(aeshList) {
  const subtabs = document.getElementById('aesh-subtabs');
  const content = document.getElementById('aesh-content');
  if (!subtabs || !content) return;

  // Build subtabs with + button
  subtabs.innerHTML = aeshList.map((a,i) =>
    `<button class="subtab-inner ${i===0?'active':''}" onclick="showAesh(${i})" id="aesh-tab-${i}">
      ${a.nom || `AESH ${i+1}`}
    </button>`
  ).join('') +
  `<button class="subtab-inner" onclick="addAeshAgent()" style="background:#F0FFF4;color:#16A34A;border-color:#BBF7D0" title="Ajouter une AESH">＋</button>`;

  // Build panels
  content.innerHTML = aeshList.map((a, ai) => `
    <div id="aesh-panel-${ai}" style="display:${ai===0?'block':'none'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="aesh-info-grid" style="flex:1">
          <div class="field-group"><label>Nom AESH</label>
            <input type="text" data-key="ebp.aesh.${ai}.nom" placeholder="AESH ${ai+1}"
              oninput="updateAeshTabName(${ai},this.value)"></div>
          <div class="field-group"><label>H/semaine</label>
            <input type="number" data-key="ebp.aesh.${ai}.heures" placeholder="20"></div>
          <div class="field-group"><label>Type de contrat</label>
            <input type="text" data-key="ebp.aesh.${ai}.contrat" placeholder="AESH-co, AESH-i…"></div>
          <div class="field-group"><label>Date fin de contrat</label>
            <input type="date" data-key="ebp.aesh.${ai}.fin"></div>
        </div>
        <button onclick="deleteAeshAgent(${ai})"
          style="margin-left:16px;background:none;border:1.5px solid #FECACA;border-radius:8px;padding:6px 10px;color:#EF4444;cursor:pointer;font-size:12px;font-weight:700;flex-shrink:0"
          title="Supprimer cette AESH">🗑️ Supprimer</button>
      </div>

      <div class="aesh-eleves-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h4>👧 Élèves accompagnés</h4>
          <button class="btn-xs" onclick="addAeshEleve(${ai})">+ Ajouter un élève</button>
        </div>
        <div id="aesh-eleves-${ai}"></div>
      </div>

      <div style="margin-top:20px;border-top:2px solid #FDE68A;padding-top:16px">
        <h4 style="font-size:15px;font-weight:900;color:#1E3A5F;margin-bottom:4px">📅 Emploi du temps</h4>
        <p style="font-size:11px;color:#94A3B8;margin:0 0 12px">Cliquez sur une cellule pour saisir. Choisissez une couleur pour chaque créneau.</p>
        <div class="aesh-edt-grid">
          <div class="aesh-cell header"></div>
          ${['Lundi','Mardi','Jeudi','Vendredi'].map(j=>`<div class="aesh-cell header">${j}</div>`).join('')}
          ${HORAIRES_AESH.map(h => {
              const hKey = h.replace(/[^0-9h]/g,'_');
              const slots = [0,1,3,4].map(d => {
                const key = `ebp.aesh.${ai}.edt.${hKey}.${d}`;
                const colorKey = `ebp.aesh.${ai}.edt.${hKey}.${d}_color`;
                return `<div class="aesh-cell edt-slot" data-colorkey="${colorKey}" style="position:relative">
                  <textarea rows="1" data-key="${key}" placeholder="" style="background:transparent;width:calc(100% - 24px)"></textarea>
                  <input type="color" value="#ffffff"
                    style="position:absolute;bottom:3px;right:3px;width:18px;height:18px;border:none;padding:0;cursor:pointer;border-radius:3px;opacity:0.7"
                    title="Couleur du créneau"
                    oninput="setEdtCellColor(this,'${colorKey}',this.closest('.edt-slot'))">
                </div>`;
              }).join('');
              return `<div class="aesh-cell time">${h}</div>${slots}`;
            }).join('')}
        </div>
      </div>
    </div>
  `).join('');

  loadFormData();
  aeshList.forEach((_, ai) => loadAeshEleves(ai));
  // Restore EDT cell colors
  document.querySelectorAll('.edt-slot[data-colorkey]').forEach(cell => {
    const colorKey = cell.dataset.colorkey;
    const color = getData(colorKey) || '';
    if (color) {
      cell.style.background = color + '55';
      const picker = cell.querySelector('input[type=color]');
      if (picker) picker.value = color;
    }
  });
}

function addAeshAgent() {
  const list = getData('ebp.aesh.list') || AESH_NOMS.map((n,i) => ({ id:i, nom:n }));
  const newId = Date.now();
  list.push({ id: newId, nom: `AESH ${list.length + 1}` });
  setData('ebp.aesh.list', list);
  debounceSave();
  // Rebuild
  const content = document.getElementById('aesh-content');
  if (content) content.innerHTML = '';
  renderAeshFull(list);
  showAesh(list.length - 1);
}

function deleteAeshAgent(ai) {
  if (!confirm('Supprimer cette AESH et toutes ses données ?')) return;
  const list = getData('ebp.aesh.list') || AESH_NOMS.map((n,i) => ({ id:i, nom:n }));
  list.splice(ai, 1);
  if (list.length === 0) list.push({ id: Date.now(), nom: 'AESH 1' });
  setData('ebp.aesh.list', list);
  debounceSave();
  const content = document.getElementById('aesh-content');
  if (content) content.innerHTML = '';
  renderAeshFull(list);
  showAesh(0);
}

function updateAeshTabName(ai, val) {
  const tab = document.getElementById(`aesh-tab-${ai}`);
  if (tab) tab.textContent = val || `AESH ${ai+1}`;
  const list = getData('ebp.aesh.list') || AESH_NOMS.map((n,i) => ({ id:i, nom:n }));
  if (list[ai]) list[ai].nom = val;
  setData('ebp.aesh.list', list);
  debounceSave();
}

function addAeshEleve(ai, data=null) {
  const container = document.getElementById(`aesh-eleves-${ai}`);
  if (!container) return;
  const d = data || {};
  const card = document.createElement('div');
  card.className = 'aesh-eleve-card';
  card.innerHTML = `
    <button class="aesh-eleve-del" onclick="this.closest('.aesh-eleve-card').remove();saveAeshEleves(${ai})">×</button>
    <div class="aesh-eleve-grid">
      <div class="field-group"><label>Nom &amp; Prénom</label>
        <input type="text" value="${d.nom||''}" placeholder="Nom Prénom…" oninput="saveAeshEleves(${ai})"></div>
      <div class="field-group"><label>Classe</label>
        <input type="text" value="${d.classe||''}" placeholder="CP, CE1…" oninput="saveAeshEleves(${ai})"></div>
      <div class="field-group"><label>Type de besoin</label>
        <select onchange="saveAeshEleves(${ai})">
          <option value="">— Choisir —</option>
          ${['AESH-co','AESH-i','PAI','PPS','RASED','Autre'].map(t =>
            `<option value="${t}" ${d.besoin===t?'selected':''}>${t}</option>`
          ).join('')}
        </select></div>
      <div class="field-group"><label>H/semaine</label>
        <input type="number" value="${d.heures||''}" placeholder="0" min="0" step="0.5" oninput="saveAeshEleves(${ai})"></div>
      <div class="field-group"><label>Horaires</label>
        <input type="text" value="${d.horaires||''}" placeholder="Matin, 8h30-11h30…" oninput="saveAeshEleves(${ai})"></div>
      <div class="field-group"><label>Notes</label>
        <input type="text" value="${d.notes||''}" placeholder="Observations…" oninput="saveAeshEleves(${ai})"></div>
    </div>`;
  container.appendChild(card);
}

function saveAeshEleves(ai) {
  const container = document.getElementById(`aesh-eleves-${ai}`);
  if (!container) return;
  const eleves = [...container.querySelectorAll('.aesh-eleve-card')].map(card => {
    const inputs = card.querySelectorAll('input,select');
    return { nom:inputs[0]?.value||'', classe:inputs[1]?.value||'', besoin:inputs[2]?.value||'', heures:inputs[3]?.value||'', horaires:inputs[4]?.value||'', notes:inputs[5]?.value||'' };
  });
  setData(`ebp.aesh.${ai}.elevesData`, eleves);
  debounceSave();
}

function loadAeshEleves(ai) {
  const container = document.getElementById(`aesh-eleves-${ai}`);
  if (!container) return;
  container.innerHTML = '';
  const saved = getData(`ebp.aesh.${ai}.elevesData`) || [];
  if (saved.length === 0) addAeshEleve(ai);
  else saved.forEach(d => addAeshEleve(ai, d));
}

function showAesh(i) {
  document.querySelectorAll('[id^=aesh-panel-]').forEach((p,j) => p.style.display = i===j?'block':'none');
  document.querySelectorAll('#aesh-subtabs .subtab-inner').forEach((b,j) => {
    if (b.getAttribute('onclick')?.includes(`showAesh`)) b.classList.toggle('active', i===j);
  });
  loadFormData();
  loadAeshEleves(i);
}

// ══════════════════════════════════════
// ANNIVERSAIRES CALENDRIER
// ══════════════════════════════════════
function buildAnnivCalendar() {
  const container = document.getElementById('anniv-calendar');
  if (!container || container.innerHTML.trim()) return;

  // Remplir les cases de sélection de classes
  const classDiv = document.getElementById('anniv-sync-classes');
  if (classDiv && !classDiv.innerHTML.trim()) {
    const classNames = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];
    classDiv.innerHTML = classNames.map((nom, i) =>
      `<label style="display:flex;align-items:center;gap:4px;background:#FDF2F8;border:1.5px solid #FBCFE8;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:700;color:#DB2777">
        <input type="checkbox" value="${i}" checked style="accent-color:#DB2777"> ${nom}
      </label>`
    ).join('');
  }

  const schoolYear = parseInt(state.meta.year.split('-')[0]) || 2025;
  // Months Sep to Jul
  const monthList = [8,9,10,11,0,1,2,3,4,5,6];
  container.innerHTML = `<div class="anniv-months">` + monthList.map(m => {
    const year = m >= 8 ? schoolYear : schoolYear + 1;
    const saved = getData(`classe.anniv.${m}`) || [];
    return `
      <div class="anniv-month-card">
        <div class="anniv-month-header" style="--c:#FBCFE8">🎂 ${MONTHS_FR[m]} ${year}</div>
        <div class="anniv-month-body" id="anniv-body-${m}">
          ${saved.map(e => annivRowHTML(m, e.day, e.name)).join('')}
        </div>
        <button class="add-anniv-btn" onclick="addAnnivEntry(${m})">+ Ajouter un anniversaire</button>
      </div>`;
  }).join('') + `</div>`;
}

function annivRowHTML(m, day='', name='') {
  return `<div class="anniv-row">
    <div class="anniv-day" style="background:#FBCFE8">
      <input type="number" value="${day}" min="1" max="31" placeholder="j" style="width:30px;border:none;background:transparent;text-align:center;font-weight:800;font-size:13px" onchange="saveAnniv(${m})">
    </div>
    <input type="text" value="${name}" placeholder="Prénom Nom, Classe…" onchange="saveAnniv(${m})">
    <button style="background:none;border:none;color:#FCA5A5;cursor:pointer;font-size:16px" onclick="this.closest('.anniv-row').remove();saveAnniv(${m})">×</button>
  </div>`;
}

function addAnnivEntry(m) {
  const body = document.getElementById(`anniv-body-${m}`);
  if (!body) return;
  body.insertAdjacentHTML('beforeend', annivRowHTML(m));
}

function saveAnniv(m) {
  const body = document.getElementById(`anniv-body-${m}`);
  if (!body) return;
  const entries = [...body.querySelectorAll('.anniv-row')].map(row => ({
    day: row.querySelector('input[type=number]')?.value || '',
    name: row.querySelector('input[type=text]')?.value || '',
  }));
  setData(`classe.anniv.${m}`, entries); debounceSave();
}

function syncAnnivFromEffectifs() {
  const classNames = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];

  // Récupérer les classes cochées
  const checkedCi = [...document.querySelectorAll('#anniv-sync-classes input[type=checkbox]:checked')]
    .map(cb => parseInt(cb.value));
  if (checkedCi.length === 0) { showToast('⚠️ Sélectionnez au moins une classe.'); return; }

  // Index de ce qui existe déjà
  const existing = {};
  for (let m = 0; m <= 11; m++) {
    (getData(`classe.anniv.${m}`) || []).forEach(e => {
      if (e.name) existing[e.name.trim().toLowerCase()] = true;
    });
  }

  const toAdd = {};
  let added = 0;

  checkedCi.forEach(ci => {
    const eleves = getData(`admin.effectifs.c${ci}`) || [];
    eleves.forEach(e => {
      if (!e.nom?.trim() || !e.ddn) return;
      const parts = e.ddn.split('-');
      if (parts.length < 3) return;
      const month = parseInt(parts[1]) - 1;
      const day   = parseInt(parts[2]);
      if (isNaN(month) || isNaN(day)) return;

      const label = `${e.nom.trim()} (${classNames[ci]})`;
      if (existing[label.toLowerCase()]) return;

      if (!toAdd[month]) toAdd[month] = [];
      toAdd[month].push({ day, name: label });
      existing[label.toLowerCase()] = true;
      added++;
    });
  });

  if (added === 0) { showToast('✅ Anniversaires déjà à jour — rien de nouveau.'); return; }

  for (const [m, entries] of Object.entries(toAdd)) {
    const saved = getData(`classe.anniv.${m}`) || [];
    const merged = [...saved, ...entries].sort((a, b) => (parseInt(a.day)||0) - (parseInt(b.day)||0));
    setData(`classe.anniv.${m}`, merged);
  }
  debounceSave();

  const container = document.getElementById('anniv-calendar');
  if (container) { container.innerHTML = ''; buildAnnivCalendar(); }
  showToast(`🎂 ${added} anniversaire(s) ajouté(s) !`);
}


// ══════════════════════════════════════
// ══ AUTORISATIONS DE SORTIES — plusieurs sorties nommées ══
function loadAutosortiesRows() {
  buildAutosortiesUI();
}

function buildAutosortiesUI() {
  const container = document.getElementById('autosorties-sorties-container');
  if (!container) return;
  const sorties = getData('classe.autosorties.sorties') || [];
  container.innerHTML = '';
  if (sorties.length === 0) {
    container.innerHTML = '<p style="color:#94A3B8;padding:20px;font-size:14px">Aucune sortie. Cliquez sur "+ Ajouter une sortie" pour commencer.</p>';
    return;
  }
  sorties.forEach((sortie, si) => {
    const div = document.createElement('div');
    div.style.cssText = 'margin-bottom:28px;background:white;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden';
    const eleves = sortie.eleves || [];
    div.innerHTML = `
      <div style="background:#FBCFE8;padding:12px 16px;display:flex;align-items:center;gap:12px">
        <input type="text" value="${sortie.nom||''}" placeholder="Nom de la sortie…"
          style="flex:1;background:transparent;border:none;border-bottom:2px solid #F9A8D4;font-size:16px;font-weight:900;color:#1E3A5F;font-family:var(--font);padding:2px 4px"
          oninput="renameSortie(${si},this.value)">
        <input type="date" value="${sortie.date||''}" style="border:none;background:transparent;font-family:var(--font);font-size:13px" onchange="updateSortieDate(${si},this.value)">
        <button class="btn-xs" onclick="addSortieEleve(${si})">+ Élève</button>
        <button onclick="deleteSortie(${si})" style="background:none;border:1.5px solid #FECACA;border-radius:8px;padding:4px 8px;color:#EF4444;cursor:pointer;font-size:12px">🗑️</button>
      </div>
      <div class="table-wrap" style="margin:0">
        <table class="data-table" style="margin:0">
          <thead><tr>
            <th style="min-width:180px">Élève</th>
            <th>Classe</th>
            <th>Notes</th>
            <th class="th-rot"><span>Retour signé</span></th>
            <th class="no-print"></th>
          </tr></thead>
          <tbody id="sortie-body-${si}">
            ${eleves.map((e,ei) => `<tr>
              <td><input type="text" value="${e.nom||''}" placeholder="Nom Prénom…" style="min-width:160px;border:none;padding:8px 10px;font-weight:600" onchange="saveSortieEleve(${si})"></td>
              <td><input type="text" value="${e.classe||''}" style="width:60px;border:none;padding:8px 6px" onchange="saveSortieEleve(${si})"></td>
              <td><input type="text" value="${e.notes||''}" placeholder="Notes…" style="border:none;padding:8px 10px" onchange="saveSortieEleve(${si})"></td>
              <td style="text-align:center"><input type="checkbox" ${e.signed?'checked':''} onchange="saveSortieEleve(${si})" style="accent-color:#F9A8D4;width:18px;height:18px"></td>
              <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveSortieEleve(${si})">×</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    container.appendChild(div);
  });
}

function openImportEffectifsModal() {
  const sorties = getData('classe.autosorties.sorties') || [];
  const classNames = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];

  // Remplir le select des sorties
  const sel = document.getElementById('import-eff-sortie-sel');
  if (sorties.length === 0) {
    showToast('⚠️ Créez d\'abord une sortie avant d\'importer des élèves.');
    return;
  }
  sel.innerHTML = sorties.map((s,i) => `<option value="${i}">${s.nom || 'Sortie ' + (i+1)}</option>`).join('');

  // Remplir les cases classes
  const classDiv = document.getElementById('import-eff-classes');
  classDiv.innerHTML = classNames.map((nom, i) => {
    const count = (getData(`admin.effectifs.c${i}`) || []).length;
    return `<label style="display:flex;align-items:center;gap:6px;background:#F8FAFF;border:1.5px solid #BFDBFE;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:13px;font-weight:700">
      <input type="checkbox" value="${i}" checked style="accent-color:#3B82F6;width:16px;height:16px">
      ${nom} <span style="font-weight:400;color:#94A3B8;font-size:11px">(${count} élèves)</span>
    </label>`;
  }).join('');

  document.getElementById('import-effectifs-modal').style.display = 'flex';
}

function doImportEffectifs() {
  const si = parseInt(document.getElementById('import-eff-sortie-sel').value);
  const checkedClasses = [...document.querySelectorAll('#import-eff-classes input[type=checkbox]:checked')]
    .map(cb => parseInt(cb.value));
  const classNames = getData('admin.effectifs.classnames') || ['CP','CE1','CE2','CM1','CM2'];

  const sorties = getData('classe.autosorties.sorties') || [];
  if (!sorties[si]) return;

  const existingNoms = new Set((sorties[si].eleves || []).map(e => e.nom.trim().toLowerCase()));
  let added = 0;

  checkedClasses.forEach(ci => {
    const eleves = getData(`admin.effectifs.c${ci}`) || [];
    eleves.forEach(e => {
      if (!e.nom || !e.nom.trim()) return;
      if (existingNoms.has(e.nom.trim().toLowerCase())) return; // pas de doublon
      sorties[si].eleves = sorties[si].eleves || [];
      sorties[si].eleves.push({ nom: e.nom, classe: classNames[ci], notes: '', signed: false });
      existingNoms.add(e.nom.trim().toLowerCase());
      added++;
    });
  });

  setData('classe.autosorties.sorties', sorties);
  debounceSave();
  document.getElementById('import-effectifs-modal').style.display = 'none';
  buildAutosortiesUI();
  showToast(`✅ ${added} élève(s) importé(s) dans "${sorties[si].nom}"`);
}


function addAutosortieNom() {
  const nom = prompt('Nom de la sortie :', 'Sortie Musée…') || 'Nouvelle sortie';
  const sorties = getData('classe.autosorties.sorties') || [];
  sorties.push({ nom, date:'', eleves:[] });
  setData('classe.autosorties.sorties', sorties);
  debounceSave();
  buildAutosortiesUI();
}

function deleteSortie(si) {
  if (!confirm('Supprimer cette sortie ?')) return;
  const sorties = getData('classe.autosorties.sorties') || [];
  sorties.splice(si, 1);
  setData('classe.autosorties.sorties', sorties);
  debounceSave();
  buildAutosortiesUI();
}

function renameSortie(si, val) {
  const sorties = getData('classe.autosorties.sorties') || [];
  if (sorties[si]) { sorties[si].nom = val; setData('classe.autosorties.sorties', sorties); debounceSave(); }
}

function updateSortieDate(si, val) {
  const sorties = getData('classe.autosorties.sorties') || [];
  if (sorties[si]) { sorties[si].date = val; setData('classe.autosorties.sorties', sorties); debounceSave(); }
}

function addSortieEleve(si) {
  const body = document.getElementById(`sortie-body-${si}`);
  if (!body) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="" placeholder="Nom Prénom…" style="min-width:160px;border:none;padding:8px 10px;font-weight:600" onchange="saveSortieEleve(${si})"></td>
    <td><input type="text" value="" style="width:60px;border:none;padding:8px 6px" onchange="saveSortieEleve(${si})"></td>
    <td><input type="text" value="" placeholder="Notes…" style="border:none;padding:8px 10px" onchange="saveSortieEleve(${si})"></td>
    <td style="text-align:center"><input type="checkbox" onchange="saveSortieEleve(${si})" style="accent-color:#F9A8D4;width:18px;height:18px"></td>
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveSortieEleve(${si})">×</button></td>`;
  body.appendChild(tr);
}

function saveSortieEleve(si) {
  const body = document.getElementById(`sortie-body-${si}`);
  if (!body) return;
  const eleves = [...body.querySelectorAll('tr')].map(tr => {
    const inputs = tr.querySelectorAll('input[type=text]');
    const signed = tr.querySelector('input[type=checkbox]')?.checked || false;
    return { nom: inputs[0]?.value||'', classe: inputs[1]?.value||'', notes: inputs[2]?.value||'', signed };
  });
  const sorties = getData('classe.autosorties.sorties') || [];
  if (sorties[si]) { sorties[si].eleves = eleves; setData('classe.autosorties.sorties', sorties); debounceSave(); }
}

function importExcelToAutosorties(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type:'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const body = document.getElementById('autosorties-body');
      body.innerHTML = '';
      rows.forEach((row, i) => {
        if (i === 0 && typeof row[0] === 'string' && /nom|prénom|élève/i.test(row[0])) return;
        const nom = [row[0],row[1]].filter(Boolean).join(' ').trim() || String(row[0]);
        addAutosortiesRow(nom);
      });
      showToast(`✅ ${body.children.length} élèves importés !`);
      saveAutosorties();
    } catch { showToast('⚠️ Erreur de lecture'); }
  };
  reader.readAsBinaryString(file);
}

function importExcelToDocsAdm(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type:'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const body = document.getElementById('classe-docsadm-body');
      if (!body) return;
      body.innerHTML = '';
      rows.forEach((row, i) => {
        if (i === 0 && /nom|prénom|élève/i.test(String(row[0]))) return;
        const nom = [row[0],row[1]].filter(Boolean).join(' ').trim() || String(row[0]);
        if (!nom) return;
        addCheckboxRow('classe-docsadm-body','classe.docsadm', nom);
      });
      showToast(`✅ ${body.children.length} élèves importés !`);
      saveCheckboxRows('classe-docsadm-body','classe.docsadm');
    } catch { showToast('⚠️ Erreur de lecture'); }
  };
  reader.readAsBinaryString(file);
}

// ══════════════════════════════════════
// COOP avec budget alloué
// ══════════════════════════════════════
function addCoopRow(data=null) {
  const body = document.getElementById('coop-body');
  if (!body) return;
  const d = data || {};
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="date" value="${d[0]||''}" oninput="calcCoop()"></td>
    <td><input type="text" value="${d[1]||''}" placeholder="Libellé…" oninput="calcCoop()"></td>
    <td><input type="number" value="${d[2]||''}" min="0" step="0.01" placeholder="0.00" oninput="calcCoop()" style="color:#22C55E;font-weight:700;width:90px"></td>
    <td><input type="number" value="${d[3]||''}" min="0" step="0.01" placeholder="0.00" oninput="calcCoop()" style="color:#EF4444;font-weight:700;width:90px"></td>
    <td><input type="text" readonly style="background:#FEF3C7;font-weight:700;width:100px" value="${d[4]||''}"></td>
    <td><input type="text" value="${d[5]||''}" placeholder="Initiales…" oninput="calcCoop()" style="width:70px"></td>
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();calcCoop()">×</button></td>
  `;
  body.appendChild(tr);
  calcCoop();
}

function calcCoop() {
  let rec = 0, dep = 0, solde = 0;
  document.querySelectorAll('#coop-body tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input[type=number]');
    const r = parseFloat(inputs[0]?.value) || 0;
    const d = parseFloat(inputs[1]?.value) || 0;
    rec += r; dep += d; solde += r - d;
    const soldeCell = tr.querySelectorAll('td')[4]?.querySelector('input');
    if (soldeCell) { soldeCell.value = solde.toFixed(2) + ' €'; soldeCell.style.color = solde >= 0 ? '#22C55E' : '#EF4444'; }
  });
  const budget = parseFloat(document.getElementById('coop-budget')?.value) || 0;
  const reste = budget - dep;
  const remEl = document.getElementById('coop-remaining');
  if (remEl) {
    remEl.textContent = budget > 0 ? `Budget: ${budget.toFixed(2)} € | Dépensé: ${dep.toFixed(2)} € | Reste: ${reste.toFixed(2)} €` : `Solde: ${solde.toFixed(2)} €`;
    remEl.className = 'budget-badge' + (reste < 0 && budget > 0 ? ' negative' : '');
  }
  const recEl = document.getElementById('coop-recettes');
  const depEl = document.getElementById('coop-depenses');
  const solEl = document.getElementById('coop-solde');
  if (recEl) recEl.textContent = rec.toFixed(2) + ' €';
  if (depEl) depEl.textContent = dep.toFixed(2) + ' €';
  if (solEl) { solEl.textContent = solde.toFixed(2) + ' €'; }
  saveCoop();
}

function saveCoop() {
  const budget = document.getElementById('coop-budget')?.value || '0';
  const rows = [...document.querySelectorAll('#coop-body tr')].map(tr =>
    [...tr.querySelectorAll('input')].map(i => i.value)
  );
  setData('classe.coop', { budget, rows }); debounceSave();
}

function loadCoopData() {
  const body = document.getElementById('coop-body');
  const budEl = document.getElementById('coop-budget');
  if (!body || body.children.length > 0) return;
  const saved = getData('classe.coop');
  if (saved) {
    if (budEl) budEl.value = saved.budget || '';
    (saved.rows || []).forEach(r => addCoopRow(r));
  } else {
    for (let i = 0; i < 3; i++) addCoopRow();
  }
  calcCoop();
  if (budEl) budEl.addEventListener('input', calcCoop);
}

// ══════════════════════════════════════
// RELEVÉS avec import Excel + headers penchés
// ══════════════════════════════════════
function buildReleves() {
  const container = document.getElementById('releves-container');
  if (!container) return;
  container.innerHTML = Array.from({length:5},(_,i) => `
    <div id="releve-${i+1}" style="display:${i===0?'block':'none'};padding:16px 0">
      <div class="releve-import-bar">
        <span class="label-sm">📥 Importer noms élèves :</span>
        <input type="file" id="releve-excel-${i+1}" accept=".xlsx,.xls,.csv" style="display:none"
          onchange="importExcelToReleve(this,${i+1})">
        <button class="btn-xs" onclick="document.getElementById('releve-excel-${i+1}').click()">📂 Fichier Excel</button>
        <button class="btn-xs" onclick="addReleveRow(${i+1})">+ Ajouter élève</button>
        <button class="btn-xs" onclick="resetReleveHeaders(${i+1})" style="margin-left:auto">↺ Réinitialiser en-têtes</button>
      </div>
      <div class="releve-wrap">
        <table class="data-table releve-table" id="releve-table-${i+1}">
          <thead id="releve-head-${i+1}"></thead>
          <tbody id="releve-body-${i+1}"></tbody>
        </table>
      </div>
    </div>
  `).join('');
  for (let i = 1; i <= 5; i++) initReleveTable(i);
}

const RELEVE_COLS = 10;

function initReleveTable(ri) {
  buildReleveHeaders(ri);
  loadReleveBody(ri);
}

function buildReleveHeaders(ri) {
  const head = document.getElementById(`releve-head-${ri}`);
  if (!head) return;
  const saved = getData(`classe.releve${ri}.headers`) || Array.from({length:RELEVE_COLS},(_,i)=>`Compétence ${i+1}`);
  head.innerHTML = `<tr>
    <th style="min-width:150px;background:linear-gradient(135deg,#FBCFE8,white)">Élève</th>
    ${saved.map((h,i) => `
      <th class="th-rot" style="background:linear-gradient(135deg,#FBCFE8,white)">
        <span><input type="text" value="${h}" style="writing-mode:vertical-rl;transform:rotate(180deg);border:none;background:transparent;font-family:inherit;font-size:11px;font-weight:700;width:18px;height:90px;text-align:center;cursor:text;color:#1E3A5F"
          onchange="saveReleveHeader(${ri},${i},this.value)"></span>
      </th>`).join('')}
    <th class="no-print" style="background:linear-gradient(135deg,#FBCFE8,white)"></th>
  </tr>`;
}

function saveReleveHeader(ri, ci, val) {
  const saved = getData(`classe.releve${ri}.headers`) || Array.from({length:RELEVE_COLS},(_,i)=>`Compétence ${i+1}`);
  saved[ci] = val;
  setData(`classe.releve${ri}.headers`, saved); debounceSave();
}

function resetReleveHeaders(ri) {
  setData(`classe.releve${ri}.headers`, Array.from({length:RELEVE_COLS},(_,i)=>`Compétence ${i+1}`));
  buildReleveHeaders(ri);
}

function addReleveRow(ri, nom='') {
  const body = document.getElementById(`releve-body-${ri}`);
  if (!body) return;
  const rowIndex = body.children.length;
  const savedCells = getData(`classe.releve${ri}.rows.${rowIndex}`) || Array(RELEVE_COLS).fill('');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="releve-name-cell"><input type="text" value="${nom}" placeholder="Nom Prénom…" style="width:100%;border:none;padding:6px 8px;font-weight:700;font-family:inherit;font-size:13px" onchange="saveReleveRow(${ri},${rowIndex},this.closest('tr'))"></td>
    ${Array.from({length:RELEVE_COLS},(_,ci) =>
      `<td><input type="text" value="${savedCells[ci]||''}" style="width:50px;text-align:center;border:none;font-family:'Caveat',cursive;font-size:14px" onchange="saveReleveRow(${ri},${rowIndex},this.closest('tr'))"></td>`
    ).join('')}
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove()">×</button></td>
  `;
  body.appendChild(tr);
}

function saveReleveRow(ri, rowIndex, tr) {
  const inputs = tr.querySelectorAll('input');
  const vals = [...inputs].map(i => i.value);
  setData(`classe.releve${ri}.rows.${rowIndex}`, vals.slice(1)); // skip name
  setData(`classe.releve${ri}.names.${rowIndex}`, vals[0]);
  debounceSave();
}

function loadReleveBody(ri) {
  const body = document.getElementById(`releve-body-${ri}`);
  if (!body || body.children.length > 0) return;
  const saved = getData(`classe.releve${ri}.names`) || {};
  const keys = Object.keys(saved);
  if (keys.length === 0) { for(let i=0;i<5;i++) addReleveRow(ri); }
  else keys.forEach(k => {
    addReleveRow(ri, saved[k]);
    const tr = body.lastElementChild;
    const cells = getData(`classe.releve${ri}.rows.${k}`) || [];
    const inputs = tr.querySelectorAll('td:not(:first-child):not(:last-child) input');
    cells.forEach((v,i) => { if(inputs[i]) inputs[i].value = v; });
  });
}

function importExcelToReleve(input, ri) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {type:'binary'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      const body = document.getElementById(`releve-body-${ri}`);
      body.innerHTML = '';
      rows.forEach((row, i) => {
        if (i === 0 && /nom|prénom|élève/i.test(String(row[0]))) return;
        const nom = [row[0],row[1]].filter(Boolean).join(' ').trim() || String(row[0]);
        addReleveRow(ri, nom);
      });
      showToast(`✅ ${body.children.length} élèves importés !`);
    } catch { showToast('⚠️ Erreur de lecture'); }
  };
  reader.readAsBinaryString(file);
}

function showReleve(n) {
  for(let i=1;i<=5;i++) { const el=document.getElementById(`releve-${i}`); if(el) el.style.display=i===n?'block':'none'; }
  document.querySelectorAll('.subtab-inner').forEach(b => b.classList.toggle('active', b.getAttribute('onclick')?.includes(`(${n})`)));
  loadReleveBody(n);
}

function initReleves() {
  for(let i=1;i<=5;i++) loadReleveBody(i);
}

// ══════════════════════════════════════
// CALENDRIERS
// ══════════════════════════════════════
function buildCalendriers() {
  const subtabs = document.getElementById('subtabs-calend');
  const content = document.getElementById('calend-content');
  if (!subtabs || !content) return;
  const periods = [
    {id:'annuel',label:'Org. annuelle',months:[8,9,10,11,0,1,2,3,4,5]},
    {id:'p1',label:'P1 Sep–Oct',months:[8,9]},{id:'p2',label:'P2 Nov–Déc',months:[10,11]},
    {id:'p3',label:'P3 Jan–Fév',months:[0,1]},{id:'p4',label:'P4 Mar–Avr',months:[2,3]},
    {id:'p5',label:'P5 Mai–Juin',months:[4,5]},
  ];
  subtabs.innerHTML = periods.map((p,i)=>
    `<button class="subtab ${i===0?'active':''}" onclick="showCalend('${p.id}')">${p.label}</button>`
  ).join('');
  content.innerHTML = periods.map(p=>
    `<div class="tab-content ${p.id==='annuel'?'active':'hidden'} calendar-wrap" id="calend-${p.id}">
      ${p.id==='annuel' ? buildAnnualCalendar() : buildPeriodCalendar(p)}
    </div>`
  ).join('');
  // Load saved data into calendar inputs
  setTimeout(()=>{ loadFormData(); tagCalendarCells(); }, 100);
}

function showCalend(id) {
  document.querySelectorAll('#calend-content .tab-content').forEach(t=>t.classList.add('hidden'));
  const panel = document.getElementById(`calend-${id}`);
  if (panel) panel.classList.remove('hidden');
  document.querySelectorAll('#subtabs-calend .subtab').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')?.includes(`'${id}'`)));
  setTimeout(()=>{ loadFormData(); tagCalendarCells(); }, 50);
}

function buildAnnualCalendar() {
  const year = parseInt(state.meta.year.split('-')[0])||2025;
  const vacs = ['Rentrée enseignants','Rentrée élèves','Toussaint','Noël','Hiver','Printemps','Été'];
  return `<h3 style="font-family:'Caveat',cursive;font-size:26px;color:#FB923C;margin-bottom:16px">Organisation ${year}–${year+1}</h3>
  <div style="overflow-x:auto;border-radius:12px;box-shadow:var(--shadow)"><table class="data-table" style="min-width:700px">
    <thead><tr style="background:#FCD34D"><th>Vacances</th><th>Dates</th><th>Sem. 1</th><th>Sem. 2</th><th>P1/P2</th><th>P3/P4</th><th>P5</th><th>Nb sem.</th></tr></thead>
    <tbody>${vacs.map((v,i)=>`<tr>
      ${['label','date','s1','s2','p12','p34','p5','nb'].map((f,j)=>
        `<td><input type="${j===7?'number':'text'}" ${j===0?`value="${v}"`:`placeholder="…"`} data-key="calend.annual.v${i}.${f}" style="padding:8px 10px;width:100%;border:none${j===0?';font-weight:700':''}"></td>`
      ).join('')}
    </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function buildPeriodCalendar(period) {
  const schoolYear = parseInt(state.meta.year.split('-')[0])||2025;
  return period.months.map(m => {
    const year = m>=8?schoolYear:schoolYear+1;
    return `<div style="margin-bottom:28px">
      <div class="cal-month-title" style="color:${getColor('calend')}">${MONTHS_FR[m]} ${year}</div>
      ${buildMonthGrid(m,year,`calend.${period.id}.${m}`)}
      <div class="remarks-zone"><label>Mes remarques — ${MONTHS_FR[m]}</label>
      <textarea data-key="calend.${period.id}.${m}.remarks" rows="3" placeholder="Notes…"></textarea></div>
    </div>`;
  }).join('');
}

function buildMonthGrid(monthIdx, year, keyPrefix) {
  const firstDay = new Date(year,monthIdx,1).getDay();
  const startDay = (firstDay===0?6:firstDay-1);
  const daysInMonth = new Date(year,monthIdx+1,0).getDate();
  const today = new Date();
  let html = `<div class="calendar-grid" style="--c:${getColor('calend')}">`;
  JOURS.forEach(j=>html+=`<div class="cal-header">${j}</div>`);
  for(let row=0;row<6;row++){
    for(let col=0;col<7;col++){
      const dn = row*7+col-startDay+1;
      const valid = dn>=1&&dn<=daysInMonth;
      const isToday = valid&&today.getDate()===dn&&today.getMonth()===monthIdx&&today.getFullYear()===year;
      if(!valid&&row>=5) continue;
      html+=`<div class="cal-day${!valid?' other-month':''}${isToday?' today':''}">
        <div class="cal-day-num">${valid?dn:''}</div>
        ${valid?`<textarea rows="2" data-key="${keyPrefix}.day${dn}" placeholder=""></textarea>`:''}
      </div>`;
    }
  }
  return html+'</div>';
}

// ══════════════════════════════════════
// TODO MENSUELLE
// ══════════════════════════════════════
function buildTodoMensuelle() {
  const subtabs = document.getElementById('subtabs-todo');
  const content = document.getElementById('todo-content');
  if (!subtabs||!content) return;
  const months = [{key:'rentree',label:'Pré-rentrée'},{key:'sep',label:'Septembre'},{key:'oct',label:'Octobre'},
    {key:'nov',label:'Novembre'},{key:'dec',label:'Décembre'},{key:'jan',label:'Janvier'},
    {key:'fev',label:'Février'},{key:'mar',label:'Mars'},{key:'avr',label:'Avril'},
    {key:'mai',label:'Mai'},{key:'juin',label:'Juin'},{key:'juil',label:'Juillet'}];
  subtabs.innerHTML = months.map((m,i)=>`<button class="subtab ${i===0?'active':''}" onclick="showTodo('${m.key}')">${m.label}</button>`).join('');
  content.innerHTML = months.map((m,i)=>`
    <div class="tab-content ${i===0?'active':'hidden'}" id="todo-${m.key}">
      <div class="todo-layout">
        <div>
          <div class="todo-list-zone">
            <h4>✅ To Do — ${m.label}</h4>
            <div id="todo-items-${m.key}"></div>
            <button class="add-todo-btn" onclick="addTodoItem('${m.key}')">+ Ajouter une tâche</button>
          </div>
          <div class="remarks-zone" style="margin-top:14px">
            <label>📝 Mes notes de ${m.label}</label>
            <textarea rows="5" data-key="todo.${m.key}.notes" placeholder="Notes libres…"></textarea>
          </div>
        </div>
        <div>
          <div class="todo-list-zone">
            <h4>📅 ${m.label}</h4>
            ${buildMiniCal(m.key)}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function buildMiniCal(mk) {
  const map={rentree:7,sep:8,oct:9,nov:10,dec:11,jan:0,fev:1,mar:2,avr:3,mai:4,juin:5,juil:6};
  const m=map[mk]??8, sy=parseInt(state.meta.year.split('-')[0])||2025;
  const year = m>=8?sy:sy+1;
  return buildMonthGrid(m,year,`todo.${mk}.caldays`);
}

function showTodo(key) {
  document.querySelectorAll('#todo-content .tab-content').forEach(t=>t.classList.add('hidden'));
  document.getElementById(`todo-${key}`)?.classList.remove('hidden');
  document.querySelectorAll('#subtabs-todo .subtab').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')?.includes(`'${key}'`)));
  setTimeout(()=>{ loadTodoItems(key); loadFormData(); tagCalendarCells(); }, 50);
}

function addTodoItem(mk,text='',checked=false) {
  const c=document.getElementById(`todo-items-${mk}`); if(!c) return;
  const div=document.createElement('div'); div.className='todo-item';
  div.innerHTML=`<input type="checkbox" ${checked?'checked':''} onchange="this.nextElementSibling.classList.toggle('done',this.checked);saveTodo('${mk}')">
    <input type="text" value="${text}" placeholder="Tâche…" oninput="saveTodo('${mk}')">
    <button style="background:none;border:none;color:#FCA5A5;cursor:pointer" onclick="this.parentElement.remove();saveTodo('${mk}')">×</button>`;
  c.appendChild(div);
  if(checked) div.querySelector('input[type=text]').classList.add('done');
}

function saveTodo(mk) {
  const c=document.getElementById(`todo-items-${mk}`); if(!c) return;
  const items=[...c.querySelectorAll('.todo-item')].map(d=>({text:d.querySelector('input[type=text]').value,checked:d.querySelector('input[type=checkbox]').checked}));
  setData(`todo.${mk}.items`,items); debounceSave();
}

const DEFAULT_TODOS = {
  rentree: [
    'Sortir les fiches renseignements de ONDE',
    'Fiches d\'urgence',
    'Charte',
    'Autorisation photos',
    'Note de rentrée',
    'Coopérative',
    'Imprimer les listes de classe',
    'Planning prévisionnel des réunions 108h',
    'Préparer le bilan coopé',
    'Récupérer les mails académiques de tous les enseignants',
    'Vérifier l\'armoire à pharmacie',
    'Imprimer les fiches de renseignements à modifier',
    'Faire les dernières inscriptions/radiations',
    'Mettre à jour le registre matricule',
    'Mettre à jour la note de rentrée (pré-rentrée)',
    'Planifier le 2ème jour de réunion de rentrée',
    'Planifier les services de surveillance de cours',
    'Fiche protocole d\'urgence à mettre à jour - PPMS',
    'Planifier exercice incendie + PPMS',
    'Planifier les réunions de rentrée avec les parents',
    'Planifier les APC',
    'Rappeler aux enseignants d\'envoyer les docs des stages de remise à niveau',
    'Demander si quelqu\'un veut participer au périscolaire / Pacte',
    'Se questionner sur les sorties de fin d\'année',
    'Imprimer les listes de classe (ONDE)',
    'Affecter tous les élèves dans les classes',
    'Rappeler les affichages obligatoires : consignes de sécurité, charte de la laïcité, déclaration des droits de l\'homme, drapeau, devise de la République, Marseillaise',
    'Rappeler les règles concernant les assurances scolaires',
    'Délimiter les périodes pour le LSU',
  ],
  sep: [
    'Mettre à jour le registre matricule : élèves',
    'Transmettre le planning des réunions à l\'inspection',
    'Transmettre les effectifs à l\'inspection',
    'Remplir la fiche-école, la transmettre à l\'IEN (tribu)',
    'Faire les admissions définitives sur ONDE',
    'Faire le C.R. de la réunion de rentrée et le transmettre',
    'États de service des AESH',
    'Récupérer les fiches de renseignements de chaque classe + MAJ ONDE',
    'Préparer les élections de parents d\'élèves',
    'Informer les familles → ONDE',
    'Vérifier la liste électorale réalisée sur ONDE',
    'Recueillir le dépôt des listes et leur affichage',
    'Organiser le vote en ligne / le matériel',
    'Préparer bilan coopé (en vue du 1er CE)',
    'Récupérer les PPRE et les sorties sur temps scolaire',
    'Organiser le 1er PPMS (courant septembre) + PV relatif',
    'Organiser le 1er exercice incendie + PV relatif + registre de sécurité',
    'Appeler le photographe — planifier les photos de classe',
    'Récupérer documents évals CP→CM2 à l\'inspection',
    'Transmettre le tableau des effectifs à l\'IEN',
    'Organiser les emplois du temps des personnels : ATSEM, AVS…',
    'Envoyer les PV d\'installation des AESH + EDT',
    'Faire un point sur les interventions et les projets APS',
    'Faire un point sur les projets artistiques à envoyer',
    'Faire un point commandes + listes APC',
    'Mettre à jour la liste des PAI, PAP (en lien avec le médecin scolaire)',
    'Envoyer les listes de classe à l\'infirmière (Nom, prénom, date nais, sexe)',
    'Faire les constats d\'effectifs (ONDE) après le 15/09',
    'Préparer les conseils des maîtres',
    'Planifier les EE de début d\'année',
    'Envoyer à la mairie les listes de classes + radiations',
  ],
  oct: [
    'Élections parents d\'élèves',
    'Transmettre PV élections à l\'inspection',
    'Afficher PV élections parents d\'élèves à l\'école',
    'Rentrer les résultats des élections dans l\'application ECECA',
    'Envoyer les invitations au 1er CE → dans les 8 j suivants + ordre du jour',
    'Préparer le 1er CE',
    'Premier point sur le marché d\'Hiver',
    'Photos de classe',
    'Récupérer les infos APC période 2',
    'Récupérer infos évals nationales + exploitations',
    'Préparer la carte scolaire (directives données par l\'IA DASEN)',
    'Rappeler la fin des commandes mairie',
    'Préparer pour les délégués de classe',
    'Préparer pour Nettoyons la nature',
    'Préparer les réunions d\'octobre',
    'Listes APC',
    'Évaluations + graphiques à transmettre',
    'Faire demandes de bilan psy',
    'Prévisions d\'effectifs — demander infos mairie + faire prévisions',
    'Préparer les EE et ESS du mois',
    'Valider les dernières commandes',
    'Préparer les stages de réussite (vacances de la Toussaint)',
    'États de service des AESH',
  ],
  nov: [
    'Prévisions d\'effectifs 2026-2027',
    'Transmettre prévisions CM',
    'Suivi des APC : créneaux + au collège élèves suivis',
    'Suivi des PPRE et prises en charge',
    'Prévisions EGPA et orientations',
    'PV du conseil d\'école (écrire et envoyer)',
    'Préparation du marché de Noël',
    'Faire un point sur les équipes éducatives à prévoir (avant janvier)',
    'Redoublements / orientations potentiels',
    'Rencontrer les parents des enfants susceptibles d\'aller en EGPA',
    'Mails au collège : prévisions 6ème',
    'Modifier le règlement suite au 1er CE, le transmettre (ONDE + pochette)',
    'Préparer les réunions du mois',
    'Exploiter les résultats des évaluations nationales',
    'Organiser les photos de classe',
    'Organiser les goûters de décembre (passage père Noël, sachets de chocolats…)',
    'Vérifier que les affichages sont à jour (listes, EDT…)',
    'Réfléchir pour les sorties de fin d\'année',
    'Commencer à faire les demandes pour la fête de l\'école',
    'États de service des AESH',
    'Commandes brioches',
    'Mots boîtes solidaires',
  ],
  dec: [
    'Marché d\'hiver',
    'Bilan financier des photos de classe',
    'Demandes de travaux mairie',
    'Programmer un conseil des maîtres liaison GS / CP',
    'Listing brioches',
    'Mots boîtes solidaires',
    'États de service AESH',
    'Repas de Noël',
  ],
  jan: [
    'Vœux aux parents',
    'Bilan financier marché d\'hiver',
    'Récupérer documents évals CP à l\'inspection',
    'Associer les classes pour les évals nationales',
    'Démarches orientations (ULIS école, EGPA)',
    'Réaliser le 2ème exercice d\'évacuation',
    'Préparer les réunions du mois',
    'Rappeler aux collègues de faire leurs livrets/LSU',
    'Préparer les stages de remise à niveau (vacances d\'Hiver)',
    'États de service AESH',
  ],
  fev: [],
  mar: [
    'Envoyer invitations 2ème CE',
    'Entrées 6ème',
    'Rappeler les demandes de temps partiel aux collègues',
    'Préparer le 2ème CE',
    'Point EBP',
    'Envoyer le PV du 2ème CE : à la mairie, inspection et affichage',
    'Parler en équipe de la fête de l\'école',
    'Préparer les stages de réussites',
    'Préparer les dossiers d\'entrée en 6ème : Basculement de ONDE sur Affelnet',
    'Préparer les réunions du mois',
    'Préparer les stages de remise à niveau (vacances de Printemps)',
    'États de service AESH',
  ],
  avr: [
    'Lancer les inscriptions pour l\'année suivante',
    'Premier point : Passages / maintiens → Conseil de cycle',
    'Commencer les préparatifs de fête de l\'école',
    'Préparer les lots de la tombola',
    'Préparer le 100ème jour',
    'Préparer les réunions du mois',
    'Bilan financier Coopé',
  ],
  mai: [
    'Organiser le 2ème exercice incendie',
    'Organiser les sorties scolaires de fin d\'année',
    'Lancer les commandes de fournitures pour début juin',
    'Point Fête de l\'école',
    'Procéder aux admissions des futurs élèves (ONDE)',
    'Préparer vacances apprenantes',
    'Commencer les dossiers 6ème',
    'Bilan coopé',
  ],
  juin: [
    'Valider les commandes de fournitures',
    'Organiser les sorties scolaires de fin d\'année',
    'Inscriptions des nouveaux élèves rentrée N+1',
    'Préparation des listes N+1 (ONDE)',
    'Transmettre les prévisions d\'effectifs à l\'IEN',
    'Bilan budget coopérative',
    'Lancer les commandes de fournitures',
    'Finir LSU',
    'Préparer les stages de remise à niveau',
    'Organiser le 3ème Conseil d\'école : bilan des activités pédagogiques',
    'Bilan des actions du projet d\'école, avenants',
    'Invitations au 3ème CE',
    'Préparer 3ème CE',
    'C.R. 3ème CE',
    'Faire les comptes : sortie scolaire / kermesse',
  ],
  juil: [
    'Valider les commandes de fournitures',
    'Récupérer les registres d\'appel',
    'Finir de préparer les stages de remise à niveau',
    'Archiver les documents',
  ],
};

function loadTodoItems(mk) {
  const saved = getData(`todo.${mk}.items`) || [];
  const c = document.getElementById(`todo-items-${mk}`); if (!c) return;
  c.innerHTML = '';
  // Charge les défauts si aucune vraie tâche n'est sauvegardée
  const realItems = saved.filter(it => it && it.text && it.text.trim());
  if (realItems.length === 0) {
    (DEFAULT_TODOS[mk] || []).forEach(t => addTodoItem(mk, t));
  } else {
    realItems.forEach(it => addTodoItem(mk, it.text, it.checked));
  }
}

// ══════════════════════════════════════
// RÉUNIONS
// ══════════════════════════════════════
function buildReunions() {
  const subtabs=document.getElementById('subtabs-reunions');
  const content=document.getElementById('reunions-content');
  if(!subtabs||!content) return;
  const items=Array.from({length:15},(_,i)=>i+1);
  subtabs.innerHTML=items.map((n,i)=>{
    const label = getData(`reunions.r${n}.label`) || `Réunion ${n}`;
    return `<button class="subtab ${i===0?'active':''}" id="reunion-tab-${n}" onclick="showReunion(${n})">${label}</button>`;
  }).join('');
  content.innerHTML=items.map(n=>{
    const label = getData(`reunions.r${n}.label`) || `Réunion ${n}`;
    return `
    <div class="tab-content ${n===1?'active':'hidden'}" id="reunion-${n}">
      <div class="reunion-card">
        <div class="reunion-card-header">
          <span>📋
            <input type="text" value="${label}"
              style="background:transparent;border:none;border-bottom:2px dashed #93C5FD;font-size:16px;font-weight:900;color:#1E3A5F;font-family:var(--font);width:220px;padding:2px 4px"
              placeholder="Nom de la réunion…"
              oninput="renameReunion(${n}, this.value)"
              title="Cliquez pour renommer">
          </span>
          <span style="font-size:13px;font-weight:600">Prise de notes</span>
        </div>`;
  }).join('') /* closed below */ + '';

  // Rebuild properly
  content.innerHTML = items.map(n => {
    const label = getData(`reunions.r${n}.label`) || `Réunion ${n}`;
    return `
    <div class="tab-content ${n===1?'active':'hidden'}" id="reunion-${n}">
      <div class="reunion-card">
        <div class="reunion-card-header">
          <span>📋 <input type="text" value="${label}"
            style="background:transparent;border:none;border-bottom:2px dashed #93C5FD;font-size:16px;font-weight:900;color:#1E3A5F;font-family:var(--font);width:240px;padding:2px 6px"
            placeholder="Nom de la réunion…"
            oninput="renameReunion(${n}, this.value)"
            title="Cliquez pour renommer cet onglet"></span>
          <span style="font-size:13px;font-weight:600">Prise de notes</span>
        </div>
        <div class="reunion-fields">
          <div class="reunion-field"><label>Date</label><input type="date" data-key="reunions.r${n}.date"></div>
          <div class="reunion-field"><label>Heure</label><input type="time" data-key="reunions.r${n}.heure"></div>
          <div class="reunion-field"><label>Lieu</label><input type="text" data-key="reunions.r${n}.lieu" placeholder="Salle des maîtres…"></div>
          <div class="reunion-field"><label>Type</label>
            <select data-key="reunions.r${n}.type">
              <option>Conseil des maîtres</option><option>Conseil de cycle</option>
              <option>Conseil d'école</option><option>Équipe éducative</option>
              <option>Réunion parents</option><option>Autre</option>
            </select>
          </div>
          <div class="reunion-field full"><label>Participants</label><textarea rows="2" data-key="reunions.r${n}.participants" placeholder="Liste des présents…"></textarea></div>
          <div class="reunion-field full"><label>Ordre du jour</label><textarea rows="3" data-key="reunions.r${n}.odj" placeholder="Points à aborder…"></textarea></div>
          <div class="reunion-field full"><label>Notes &amp; discussions</label><textarea rows="5" data-key="reunions.r${n}.notes" placeholder="Notes libres…"></textarea></div>
          <div class="reunion-field full"><label>Décisions &amp; actions</label><textarea rows="3" data-key="reunions.r${n}.decisions" placeholder="Actions à mener, responsables…"></textarea></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function setEdtCellColor(input, colorKey, cell) {
  const color = input.value;
  cell.style.background = color === '#ffffff' ? 'transparent' : color + '55'; // semi-transparent
  setData(colorKey, color === '#ffffff' ? '' : color);
  debounceSave();
}

function renameReunion(n, val) {
  setData(`reunions.r${n}.label`, val);
  const tab = document.getElementById(`reunion-tab-${n}`);
  if (tab) tab.textContent = val || `Réunion ${n}`;
  debounceSave();
}


function showReunion(n) {
  document.querySelectorAll('#reunions-content .tab-content').forEach(t=>t.classList.add('hidden'));
  document.getElementById(`reunion-${n}`)?.classList.remove('hidden');
  document.querySelectorAll('#subtabs-reunions .subtab').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')?.includes(`(${n})`)));
  loadFormData();
}

// ══════════════════════════════════════
// RDV PARENTS
// ══════════════════════════════════════
function buildRdvGrid() {
  const saved = getData('ebp.rdv')||[];
  if(saved.length===0){for(let i=0;i<4;i++) addRdvFiche(false);}
  else saved.forEach(f=>addRdvFicheFromData(f));
}
function addRdvFiche(save=true){addRdvFicheFromData({id:Date.now(),eleve:'',date:'',demande:'parents',cr:''});if(save) saveRdvData();}
function addRdvFicheFromData(f){
  const grid=document.getElementById('rdv-grid'); if(!grid) return;
  const div=document.createElement('div'); div.className='rdv-fiche'; div.dataset.id=f.id;
  div.innerHTML=`<button class="rdv-delete" onclick="this.parentElement.remove();saveRdvData()">×</button>
    <label>Élève</label><input type="text" value="${f.eleve||''}" placeholder="Nom &amp; Prénom" onchange="saveRdvData()">
    <label>Date</label><input type="date" value="${f.date||''}" onchange="saveRdvData()">
    <label>Demandé par</label>
    <div class="rdv-demande">
      <label><input type="radio" name="rdv-dem-${f.id}" value="parents" ${f.demande!=='ecole'?'checked':''} onchange="saveRdvData()"> Parents</label>
      <label><input type="radio" name="rdv-dem-${f.id}" value="ecole" ${f.demande==='ecole'?'checked':''} onchange="saveRdvData()"> École</label>
    </div>
    <label>Compte-rendu</label><textarea onchange="saveRdvData()">${f.cr||''}</textarea>`;
  grid.appendChild(div);
}
function saveRdvData(){
  const fiches=[...document.querySelectorAll('.rdv-fiche')].map(f=>({id:f.dataset.id,eleve:f.querySelector('input[type=text]').value,date:f.querySelector('input[type=date]').value,demande:f.querySelector('input[type=radio]:checked')?.value||'parents',cr:f.querySelector('textarea').value}));
  setData('ebp.rdv',fiches); debounceSave();
}

// ══════════════════════════════════════
// EDITABLE TABLES (generic)
// ══════════════════════════════════════
function buildEditorTables(){
  document.querySelectorAll('.editable-table').forEach(t=>{
    const tbody = t.querySelector('tbody');
    if (tbody && tbody.children.length > 0) return; // already loaded
    const key=t.dataset.key; const rows=getData(key)||[];
    if(rows.length===0){for(let i=0;i<3;i++) addRowToTable(t);}
    else rows.forEach(r=>addRowToTable(t,r));
  });
}
function reloadEditorTable(tableId){
  const t = document.getElementById(tableId);
  if (!t) return;
  const tbody = t.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const key = t.dataset.key; const rows = getData(key)||[];
  if(rows.length===0){for(let i=0;i<3;i++) addRowToTable(t);}
  else rows.forEach(r=>addRowToTable(t,r));
}
function addRow(btn){addRowToTable(btn.closest('table'));}
function addRowToTable(table,data=null){
  const ncols=table.querySelector('thead tr').querySelectorAll('th').length-1;
  const tbody=table.querySelector('tbody'); const tr=document.createElement('tr');
  for(let i=0;i<ncols;i++){const td=document.createElement('td');const inp=document.createElement('input');inp.type='text';inp.value=data?(data[i]||''):'';inp.addEventListener('change',()=>saveTableData(table));td.appendChild(inp);tr.appendChild(td);}
  const td=document.createElement('td');td.className='no-print';td.innerHTML='<button class="delete-row-btn" onclick="this.closest(\'tr\').remove();saveTableData(this.closest(\'table\'))">×</button>';tr.appendChild(td);tbody.appendChild(tr);
}
function saveTableData(table){const key=table.dataset.key;if(!key) return;const rows=[...table.querySelectorAll('tbody tr')].map(tr=>[...tr.querySelectorAll('td input')].map(i=>i.value));setData(key,rows);debounceSave();}

// ══════════════════════════════════════
// FORM DATA
// ══════════════════════════════════════
function loadFormData(){
  setTimeout(()=>{
    document.querySelectorAll('[data-key]:not(.editable-table)').forEach(el=>{
      const val=getData(el.dataset.key); if(val===undefined||val===null) return;
      if(el.type==='checkbox') el.checked=!!val;
      else if(el.tagName==='SELECT') el.value=val;
      else el.value=val;
    });
    bindFormInputs();
  },50);
}
function bindFormInputs(){
  document.querySelectorAll('[data-key]:not(.editable-table)').forEach(el=>{
    if(el._bound) return; el._bound=true;
    el.addEventListener(el.type==='checkbox'?'change':'input',()=>{setData(el.dataset.key,el.type==='checkbox'?el.checked:el.value);debounceSave();});
  });
}

// ══════════════════════════════════════
// DATA HELPERS
// ══════════════════════════════════════
function getData(path){const parts=path.split('.');let o=state.data;for(const p of parts){if(o==null) return null;o=o[p];}return o;}
function setData(path,val){const parts=path.split('.');let o=state.data;for(let i=0;i<parts.length-1;i++){if(!o[parts[i]])o[parts[i]]={};o=o[parts[i]];}o[parts[parts.length-1]]=val;}

// ══════════════════════════════════════
// SAVE / LOAD / ONEDRIVE
// ══════════════════════════════════════
let saveTimer = null;
let fileHandle = null;

function debounceSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveAll, 1500); }
function startAutoSave() { setInterval(saveAll, 60000); }
function getPayload() { return JSON.stringify({ meta: state.meta, data: state.data, canvas: state.canvas }, null, 2); }

// ── IndexedDB : mémorise le handle fichier entre sessions ──
function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cahier_handles', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject();
  });
}
async function saveHandleToDB(handle) {
  try { const db = await openHandleDB(); db.transaction('handles','readwrite').objectStore('handles').put(handle,'onedrive'); } catch {}
}
async function loadHandleFromDB() {
  try {
    const db = await openHandleDB();
    return new Promise(res => {
      const req = db.transaction('handles').objectStore('handles').get('onedrive');
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch { return null; }
}
async function clearHandleFromDB() {
  try { const db = await openHandleDB(); db.transaction('handles','readwrite').objectStore('handles').delete('onedrive'); } catch {}
}

// ── Reconnexion silencieuse au démarrage ──
async function tryAutoReconnect() {
  if (!window.showSaveFilePicker) return;
  const handle = await loadHandleFromDB();
  if (!handle) return;
  fileHandle = handle;
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    updateOneDriveStatus(true, handle.name);
    // Si fichier plus récent que localStorage → proposer rechargement
    try {
      const file = await handle.getFile();
      const localTs = parseInt(localStorage.getItem('cahier_last_save') || '0');
      if (file.lastModified > localTs) {
        if (confirm('☁️ Des données plus récentes ont été trouvées dans votre OneDrive.\nVoulez-vous les charger ?')) {
          applyImportedData(JSON.parse(await file.text()));
          showToast('☁️ Données rechargées depuis OneDrive !');
        }
      } else {
        showToast('☁️ OneDrive reconnecté automatiquement');
      }
    } catch {}
  } else {
    updateOneDriveStatus('pending', handle.name);
    showToast('☁️ OneDrive : cliquez 💾 pour resynchroniser');
  }
}

// ── Sauvegarde ──
async function saveAll() {
  try {
    localStorage.setItem('cahier_data_' + state.meta.year, JSON.stringify(state.data));
    localStorage.setItem('cahier_canvas_' + state.meta.year, JSON.stringify(state.canvas));
    localStorage.setItem('cahier_last_save', Date.now().toString());
  } catch(e) {}

  if (fileHandle) {
    try {
      const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') { showToast('💾 Sauvegardé localement (permission OneDrive refusée)'); return; }
      const w = await fileHandle.createWritable();
      await w.write(getPayload());
      await w.close();
      updateOneDriveStatus(true, fileHandle.name);
      showToast('💾 Sauvegardé localement + ☁️ OneDrive');
      return;
    } catch(e) {
      updateOneDriveStatus(false);
    }
  }
  showToast('💾 Sauvegardé localement');
}

function loadAllData() {
  try {
    const d = localStorage.getItem('cahier_data_' + state.meta.year); if (d) state.data = JSON.parse(d);
    const c = localStorage.getItem('cahier_canvas_' + state.meta.year); if (c) state.canvas = JSON.parse(c);
  } catch(e) {}
}

// ── 1er clic : choisir/créer le fichier OneDrive ──
async function linkOneDriveFile() {
  if (!window.showSaveFilePicker) {
    exportData();
    showToast('💡 Sauvegardez ce fichier dans votre OneDrive, puis "Charger".');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `cahier-direction-${state.meta.year}.json`,
      startIn: 'documents',
      types: [{ description: 'Cahier JSON', accept: { 'application/json': ['.json'] } }],
    });
    fileHandle = handle;
    await saveHandleToDB(handle);
    await saveAll();
    updateOneDriveStatus(true, handle.name);
    closeOdSetup();
    showToast('✅ Fichier OneDrive lié ! La synchro est maintenant automatique.');
  } catch(e) { if (e.name !== 'AbortError') showToast('⚠️ Impossible de lier le fichier'); }
}

// ── Recharger depuis le fichier lié ──
async function loadFromLinkedFile() {
  if (!fileHandle) { importFromFile(); return; }
  try {
    const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { showToast('⚠️ Permission refusée'); return; }
    const file = await fileHandle.getFile();
    applyImportedData(JSON.parse(await file.text()));
    closeOdSetup();
    showToast('☁️ Données rechargées depuis OneDrive !');
  } catch { showToast('⚠️ Erreur lecture fichier'); }
}

// ── Délier ──
async function unlinkOneDrive() {
  if (!confirm('Délier OneDrive ? Vos données restent sauvegardées localement.')) return;
  fileHandle = null;
  await clearHandleFromDB();
  updateOneDriveStatus(false);
  closeOdSetup();
  showToast('OneDrive délié');
}

// ── Import fichier local (fallback Android / Firefox) ──
async function importFromFile() {
  if (!window.showOpenFilePicker) { document.getElementById('file-import-input').click(); return; }
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Cahier JSON', accept: { 'application/json': ['.json'] } }] });
    fileHandle = handle;
    await saveHandleToDB(handle);
    const file = await handle.getFile();
    applyImportedData(JSON.parse(await file.text()));
    updateOneDriveStatus(true, handle.name);
    showToast('☁️ Données chargées et fichier lié !');
  } catch(e) { if (e.name !== 'AbortError') showToast("⚠️ Erreur d'ouverture"); }
}

function handleFileInputChange(input) {
  const file = input.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => { try { applyImportedData(JSON.parse(e.target.result)); showToast('📂 Données importées ✅'); } catch { showToast('⚠️ Fichier invalide'); } };
  r.readAsText(file);
}

function applyImportedData(parsed) {
  if (parsed.meta) { state.meta = parsed.meta; localStorage.setItem('cahier_meta', JSON.stringify(state.meta)); }
  if (parsed.data) { state.data = parsed.data; localStorage.setItem('cahier_data_' + state.meta.year, JSON.stringify(state.data)); }
  if (parsed.canvas) { state.canvas = parsed.canvas; }
  document.getElementById('topbar-info').textContent = `${state.meta.school} — ${state.meta.year}`;
  document.getElementById('sidebar-school').textContent = state.meta.school;
  document.getElementById('sidebar-year').textContent = state.meta.year;
  buildDynamicSections(); gotoSection(state.currentSection);
}

function updateOneDriveStatus(linked, filename) {
  const dot = document.getElementById('onedrive-dot');
  const btn = document.getElementById('onedrive-btn');
  if (!dot) return;
  if (linked === true) {
    dot.style.background = '#22C55E';
    dot.title = `☁️ OneDrive lié : ${filename || ''}`;
    if (btn) btn.title = `OneDrive lié — cliquer pour gérer`;
  } else if (linked === 'pending') {
    dot.style.background = '#FCD34D';
    dot.title = '☁️ OneDrive : cliquer 💾 pour relancer';
  } else {
    dot.style.background = '#CBD5E1';
    dot.title = 'OneDrive non lié — cliquer ☁️ pour lier';
  }
}

// ── Modale OneDrive ──
function openOdSetup() {
  const linked = !!fileHandle;
  document.getElementById('od-setup-modal').style.display = 'flex';
  document.getElementById('od-linked-panel').style.display = linked ? 'block' : 'none';
  document.getElementById('od-unlinked-panel').style.display = linked ? 'none' : 'block';
  if (linked) document.getElementById('od-filename').textContent = fileHandle.name;
}
function closeOdSetup() { document.getElementById('od-setup-modal').style.display = 'none'; }
function saveOdClientId() {} // compat


function changeYear(){
  saveAll();
  const ny=prompt('Nouvelle année scolaire (ex: 2026-2027):',state.meta.year);
  if(ny&&/^\d{4}-\d{4}$/.test(ny)){
    state.meta.year=ny;state.data={};state.canvas={};fileHandle=null;updateOneDriveStatus(false);
    localStorage.setItem('cahier_meta',JSON.stringify(state.meta));
    loadAllData();
    document.getElementById('topbar-info').textContent=`${state.meta.school} — ${ny}`;
    document.getElementById('sidebar-year').textContent=ny;
    buildDynamicSections();gotoSection(state.currentSection);
    showToast(`📅 Année ${ny} !`);
  }
}

function exportData(){
  saveAll();
  const blob=new Blob([getPayload()],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`cahier-direction-${state.meta.year}.json`;a.click();
  showToast('📤 Exporté !');
}

function clearSection(){
  if(confirm(`Effacer toutes les données de la section "${state.currentSection}" ?`)){
    delete state.data[state.currentSection];saveAll();location.reload();
  }
}

// ══════════════════════════════════════
// CANVAS / STYLUS
// ══════════════════════════════════════
function initCanvases(){
  setTimeout(()=>{document.querySelectorAll('.drawing-canvas').forEach(c=>{if(!c._init){c._init=true;setupCanvas(c);}});},100);
}
function setupCanvas(canvas){
  const zone=canvas.closest('.canvas-zone');const cid=zone?.dataset.canvas||('c'+Math.random().toString(36).slice(2));zone?.setAttribute('data-canvas',cid);
  canvas.width=canvas.offsetWidth||800;canvas.height=200;
  const ctx=canvas.getContext('2d');
  ctx.strokeStyle='#E2E8F0';ctx.lineWidth=0.8;
  for(let y=32;y<canvas.height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
  const saved=state.canvas[cid];if(saved){const img=new Image();img.onload=()=>ctx.drawImage(img,0,0);img.src=saved;}
  let drawing=false,lx=0,ly=0;
  function gp(e){const r=canvas.getBoundingClientRect(),sx=canvas.width/r.width,sy=canvas.height/r.height;if(e.touches)return{x:(e.touches[0].clientX-r.left)*sx,y:(e.touches[0].clientY-r.top)*sy};return{x:(e.clientX-r.left)*sx,y:(e.clientY-r.top)*sy};}
  canvas.addEventListener('pointerdown',e=>{if(!state.stylusMode&&e.pointerType==='touch')return;drawing=true;const p=gp(e);lx=p.x;ly=p.y;e.preventDefault();},{passive:false});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=gp(e);ctx.beginPath();
    if(state.currentTool==='eraser'){ctx.globalCompositeOperation='destination-out';ctx.lineWidth=(parseInt(document.getElementById('pen-size')?.value)||2)*3;}
    else{ctx.globalCompositeOperation='source-over';ctx.strokeStyle=document.getElementById('pen-color')?.value||'#1E3A5F';ctx.lineWidth=state.currentTool==='marker'?(parseInt(document.getElementById('pen-size')?.value)||2)*3:(parseInt(document.getElementById('pen-size')?.value)||2);ctx.globalAlpha=state.currentTool==='marker'?.4:1;}
    ctx.lineCap='round';ctx.lineJoin='round';ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.globalAlpha=1;lx=p.x;ly=p.y;e.preventDefault();},{passive:false});
  function stop(){if(!drawing)return;drawing=false;state.canvas[cid]=canvas.toDataURL();debounceSave();}
  canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointerleave',stop);
}
function toggleStylus(){state.stylusMode=!state.stylusMode;document.body.classList.toggle('stylus-mode',state.stylusMode);document.getElementById('stylus-btn').classList.toggle('active',state.stylusMode);document.getElementById('stylus-toolbar').classList.toggle('hidden',!state.stylusMode);showToast(state.stylusMode?'✏️ Mode stylet activé':'⌨️ Mode clavier');}
function setTool(t){state.currentTool=t;document.querySelectorAll('.stylus-toolbar button').forEach(b=>b.classList.remove('tool-active'));event.target.classList.add('tool-active');}
function clearCanvas(){const c=document.querySelector('.section:not(.hidden) .drawing-canvas');if(!c) return;if(confirm('Effacer ?')){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);const z=c.closest('.canvas-zone');if(z) delete state.canvas[z.dataset.canvas];debounceSave();}}
function printSection(){window.print();}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.add('hidden'),2500);}

// ══════════════════════════════════════
// NOTES & RAPPELS
// ══════════════════════════════════════
let notesFilter = 'all';

const NOTE_TYPES = {
  urgent: { label: '🔴 Urgent',  color: '#EF4444' },
  todo:   { label: '🟡 À faire', color: '#F59E0B' },
  info:   { label: '🔵 Info',    color: '#3B82F6' },
  done:   { label: '✅ Fait',    color: '#22C55E' },
};

function toggleNotes() {
  const panel = document.getElementById('notes-panel');
  const overlay = document.getElementById('notes-overlay');
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !isHidden);
  overlay.classList.toggle('hidden', !isHidden);
  if (!isHidden) return;
  document.getElementById('notes-btn').classList.toggle('active', true);
  loadNotes();
}

function closeNotes() {
  document.getElementById('notes-panel')?.classList.add('hidden');
  document.getElementById('notes-overlay')?.classList.add('hidden');
  document.getElementById('notes-btn')?.classList.remove('active');
}

function addNote(type='todo') {
  const notes = getData('notes.list') || [];
  const note = {
    id: Date.now(),
    type,
    title: '',
    body: '',
    date: new Date().toLocaleDateString('fr-FR'),
    done: false,
  };
  notes.unshift(note);
  setData('notes.list', notes);
  debounceSave();
  renderNotes();
  // Focus first title
  setTimeout(() => document.querySelector('.note-title-input')?.focus(), 50);
  updateNotesBadge();
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  if (!list) return;
  const notes = getData('notes.list') || [];
  const filtered = notesFilter === 'all' ? notes : notes.filter(n =>
    notesFilter === 'done' ? n.done : n.type === notesFilter && !n.done
  );
  if (filtered.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:#94A3B8;padding:40px 20px;font-family:'Caveat',cursive;font-size:18px">
      Aucune note${notesFilter !== 'all' ? ' dans cette catégorie' : ''}… ✨<br>
      <button class="btn-xs" style="margin-top:12px" onclick="addNote()">+ Créer une note</button>
    </div>`;
    return;
  }
  list.innerHTML = filtered.map(note => `
    <div class="note-card ${note.done ? 'done' : note.type}" data-id="${note.id}">
      <div class="note-card-toolbar">
        <select class="note-type-select" onchange="updateNoteType(${note.id},this.value)">
          ${Object.entries(NOTE_TYPES).map(([k,v]) =>
            `<option value="${k}" ${note.type===k?'selected':''}>${v.label}</option>`
          ).join('')}
        </select>
        <span class="note-date-label">📅 ${note.date}</span>
        <button class="note-done-btn" onclick="toggleNoteDone(${note.id})" title="${note.done?'Rouvrir':'Marquer fait'}">${note.done?'↩️':'✅'}</button>
        <button class="note-delete-btn" onclick="deleteNote(${note.id})" title="Supprimer">🗑️</button>
      </div>
      <input class="note-title-input" type="text" value="${escHtml(note.title)}"
        placeholder="Titre du rappel…" onchange="updateNoteField(${note.id},'title',this.value)">
      <textarea class="note-body-input" rows="3" placeholder="Détails, contexte…"
        onchange="updateNoteField(${note.id},'body',this.value)">${escHtml(note.body)}</textarea>
    </div>
  `).join('');
  updateNotesBadge();
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function updateNoteField(id, field, val) {
  const notes = getData('notes.list') || [];
  const n = notes.find(x => x.id === id);
  if (n) { n[field] = val; setData('notes.list', notes); debounceSave(); }
}

function updateNoteType(id, type) {
  updateNoteField(id, 'type', type);
  renderNotes();
}

function toggleNoteDone(id) {
  const notes = getData('notes.list') || [];
  const n = notes.find(x => x.id === id);
  if (n) { n.done = !n.done; if(n.done) n.type='done'; setData('notes.list', notes); debounceSave(); renderNotes(); }
}

function deleteNote(id) {
  if (!confirm('Supprimer cette note ?')) return;
  const notes = (getData('notes.list') || []).filter(x => x.id !== id);
  setData('notes.list', notes); debounceSave(); renderNotes();
}

function filterNotes(type) {
  notesFilter = type;
  document.querySelectorAll('.note-filter').forEach(b =>
    b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${type}'`))
  );
  renderNotes();
}

function loadNotes() { renderNotes(); updateNotesBadge(); }

function updateNotesBadge() {
  const btn = document.getElementById('notes-btn');
  if (!btn) return;
  const notes = getData('notes.list') || [];
  const urgent = notes.filter(n => n.type === 'urgent' && !n.done).length;
  const existing = btn.querySelector('.notes-badge');
  if (existing) existing.remove();
  if (urgent > 0) {
    const badge = document.createElement('span');
    badge.className = 'notes-badge';
    badge.textContent = urgent > 9 ? '9+' : urgent;
    btn.appendChild(badge);
  }
}


// ══════════════════════════════════════
// GOOGLE CALENDAR — OAuth2
// ══════════════════════════════════════

let gcalConfig = {
  clientId: '',
  opts: { calend: true, todo: true },
  color: '#4285F4',
  connected: false,
  accessToken: null,
  tokenExpiry: null,
  userEmail: '',
  userName: '',
  userAvatar: '',
};

let gcalEvents = [];

// ── CONFIG UI ─────────────────────────
function openGCalConfig() {
  loadGCalConfig();
  document.getElementById('gcal-modal').classList.remove('hidden');
  document.getElementById('gcal-overlay').classList.remove('hidden');
  populateGCalForm();
}

function closeGCalConfig() {
  document.getElementById('gcal-modal').classList.add('hidden');
  document.getElementById('gcal-overlay').classList.add('hidden');
}

function loadGCalConfig() {
  try {
    const saved = localStorage.getItem('cahier_gcal');
    if (saved) gcalConfig = { ...gcalConfig, ...JSON.parse(saved) };
  } catch {}
}

function saveGCalConfig() {
  gcalConfig.clientId = document.getElementById('gcal-clientid')?.value?.trim() || gcalConfig.clientId;
  gcalConfig.opts.calend = document.getElementById('gcal-opt-calend')?.checked ?? true;
  gcalConfig.opts.todo   = document.getElementById('gcal-opt-todo')?.checked ?? true;
  gcalConfig.color       = document.getElementById('gcal-color')?.value || '#4285F4';
  localStorage.setItem('cahier_gcal', JSON.stringify(gcalConfig));
}

function populateGCalForm() {
  const loginPanel     = document.getElementById('gcal-login-panel');
  const connectedPanel = document.getElementById('gcal-connected-panel');

  if (gcalConfig.connected && gcalConfig.accessToken && !isTokenExpired()) {
    loginPanel.style.display     = 'none';
    connectedPanel.style.display = 'block';
    updateGCalStatus({ type:'success', msg:`✅ Connecté — dernier sync : ${gcalConfig.lastSync || 'jamais'}` });
    renderUserBadge();
    const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
    chk('gcal-opt-calend', gcalConfig.opts.calend);
    chk('gcal-opt-todo',   gcalConfig.opts.todo);
    const colorEl = document.getElementById('gcal-color');
    if (colorEl) colorEl.value = gcalConfig.color;
    // Reconstruire la liste des calendriers depuis la config sauvegardée
    if (gcalConfig.calendarFilters && gcalConfig.knownCalendars) {
      buildCalendarFilterUI(gcalConfig.knownCalendars);
    }
  } else {
    loginPanel.style.display     = 'block';
    connectedPanel.style.display = 'none';
    const el = document.getElementById('gcal-clientid');
    if (el) el.value = gcalConfig.clientId;
    updateGCalStatus(null);
  }
}

function renderUserBadge() {
  const badge = document.getElementById('gcal-user-badge');
  if (!badge) return;
  badge.innerHTML = `
    ${gcalConfig.userAvatar
      ? `<img src="${gcalConfig.userAvatar}" alt="avatar">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4285F4,#34A853);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px">${(gcalConfig.userName||'G')[0]}</div>`
    }
    <div class="gcal-user-badge-info">
      <span class="gcal-user-badge-name">${gcalConfig.userName || 'Compte Google'}</span>
      <span class="gcal-user-badge-email">${gcalConfig.userEmail || ''}</span>
    </div>
    <div class="gcal-user-badge-dot"></div>`;
}

function updateGCalStatus(info) {
  const el = document.getElementById('gcal-status');
  if (!el) return;
  if (!info) { el.className = 'gcal-status'; el.textContent = ''; return; }
  el.className = `gcal-status ${info.type}`;
  el.textContent = info.msg;
}

// ── OAUTH2 FLOW ───────────────────────
function startOAuth() {
  const clientId = document.getElementById('gcal-clientid')?.value?.trim();
  if (!clientId) {
    updateGCalStatus({ type:'error', msg:'⚠️ Collez d\'abord votre Client ID.' });
    return;
  }
  gcalConfig.clientId = clientId;
  localStorage.setItem('cahier_gcal', JSON.stringify(gcalConfig));

  const redirectUri = window.location.origin + '/cahier-direction';
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth`
    + `?client_id=${encodeURIComponent(clientId)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&response_type=token`
    + `&scope=${scope}`
    + `&prompt=select_account`;

  // Open popup
  const popup = window.open(authUrl, 'gcal_oauth',
    'width=500,height=650,scrollbars=yes,resizable=yes');

  // Listen for redirect back
  const timer = setInterval(() => {
    try {
      if (!popup || popup.closed) { clearInterval(timer); return; }
      const url = popup.location.href;
      if (url.includes('access_token')) {
        clearInterval(timer);
        popup.close();
        const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
        const token   = params.get('access_token');
        const expiry  = Date.now() + (parseInt(params.get('expires_in') || 3600) * 1000);
        handleOAuthToken(token, expiry);
      }
    } catch(e) {
      // Cross-origin — still loading, continue waiting
    }
  }, 500);

  // Fallback: also check hash on page load (for redirect flow)
  sessionStorage.setItem('gcal_oauth_pending', '1');
}

function handleOAuthToken(token, expiry) {
  if (!token) {
    updateGCalStatus({ type:'error', msg:'❌ Connexion annulée ou échouée.' });
    return;
  }
  gcalConfig.accessToken = token;
  gcalConfig.tokenExpiry = expiry;
  gcalConfig.connected   = true;

  // Fetch user info
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(info => {
    gcalConfig.userEmail  = info.email  || '';
    gcalConfig.userName   = info.name   || '';
    gcalConfig.userAvatar = info.picture || '';
    localStorage.setItem('cahier_gcal', JSON.stringify(gcalConfig));
    populateGCalForm();
    updateGCalBtnDot(true);
    showSyncBar(true);
    closeGCalConfig();
    showToast(`✅ Connecté en tant que ${gcalConfig.userEmail}`);
    syncGCal();
  })
  .catch(() => {
    localStorage.setItem('cahier_gcal', JSON.stringify(gcalConfig));
    populateGCalForm();
    syncGCal();
  });
}

function isTokenExpired() {
  if (!gcalConfig.tokenExpiry) return true;
  return Date.now() > gcalConfig.tokenExpiry - 60000; // 1 min buffer
}

// ── CHECK HASH ON LOAD (redirect fallback) ──
function checkOAuthRedirect() {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token') && sessionStorage.getItem('gcal_oauth_pending')) {
    sessionStorage.removeItem('gcal_oauth_pending');
    const params = new URLSearchParams(hash.slice(1));
    const token  = params.get('access_token');
    const expiry = Date.now() + (parseInt(params.get('expires_in') || 3600) * 1000);
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
    loadGCalConfig();
    handleOAuthToken(token, expiry);
  }
}

// ── FETCH ALL CALENDARS ───────────────
async function fetchAllCalendars(token) {
  const resp = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return (data.items || []).map(c => ({ id: c.id, name: c.summary, color: c.backgroundColor }));
}

async function syncGCal() {
  loadGCalConfig();
  if (!gcalConfig.accessToken || isTokenExpired()) {
    showToast('⚠️ Session expirée — reconnectez-vous via 📅');
    gcalConfig.connected = false;
    updateGCalBtnDot(false);
    showSyncBar(false);
    return;
  }

  updateGCalStatus({ type:'loading', msg:'⏳ Synchronisation en cours…' });
  try {
    const calendars = await fetchAllCalendars(gcalConfig.accessToken);

    // Mémoriser les calendriers connus + construire le filtre UI
    if (!gcalConfig.calendarFilters) gcalConfig.calendarFilters = {};
    gcalConfig.knownCalendars = calendars; // mémoriser pour rouvrir la modale
    buildCalendarFilterUI(calendars);

    const allEvents = [];
    for (const cal of calendars) {
      // Ignorer les calendriers décochés
      if (gcalConfig.calendarFilters[cal.id] === false) continue;
      const evs = await fetchGCalEvents(cal.id, gcalConfig.accessToken, cal.color);
      allEvents.push(...evs);
    }

    gcalEvents = allEvents;
    gcalConfig.lastSync = new Date().toLocaleString('fr-FR');
    localStorage.setItem('cahier_gcal', JSON.stringify(gcalConfig));

    if (gcalConfig.opts.calend) injectEventsIntoCalendars();
    if (gcalConfig.opts.todo)   injectEventsIntoCalendars();

    updateGCalStatus({ type:'success', msg:`✅ ${allEvents.length} événement(s) synchronisé(s) — ${gcalConfig.lastSync}` });
    showSyncBar(true);
    updateGCalBtnDot(true);
    showToast(`📅 ${allEvents.length} événement(s) Google synchronisé(s) !`);
  } catch(e) {
    updateGCalStatus({ type:'error', msg:`❌ Erreur : ${e.message}` });
    showToast('⚠️ Erreur de synchronisation');
  }
}

function buildCalendarFilterUI(calendars) {
  const container = document.getElementById('gcal-calendars-list');
  const filterDiv  = document.getElementById('gcal-calendars-filter');
  if (!container || !filterDiv) return;

  filterDiv.style.display = 'block';
  container.innerHTML = '';

  calendars.forEach(cal => {
    // Par défaut coché, sauf si explicitement décoché
    const checked = gcalConfig.calendarFilters[cal.id] !== false;
    const color = cal.color || '#4285F4';
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:5px 8px;border-radius:8px;background:#F8FAFF;border:1.5px solid #E2E8F0';
    label.innerHTML = `
      <input type="checkbox" ${checked ? 'checked' : ''} style="accent-color:${color};width:15px;height:15px">
      <span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0"></span>
      <span style="font-weight:600;color:#1E3A5F;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cal.name}</span>
    `;
    const cb = label.querySelector('input');
    cb.addEventListener('change', () => {
      gcalConfig.calendarFilters[cal.id] = cb.checked;
      localStorage.setItem('cahier_gcal', JSON.stringify(gcalConfig));
    });
    container.appendChild(label);
  });
}

// ── FETCH EVENTS (OAuth) ──────────────
async function fetchGCalEvents(calendarId, token, calColor) {
  const yearStart = parseInt(state.meta.year.split('-')[0]) || new Date().getFullYear();
  const timeMin = new Date(yearStart, 8, 1).toISOString();
  const timeMax = new Date(yearStart + 1, 6, 31).toISOString();

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    + `?timeMin=${encodeURIComponent(timeMin)}`
    + `&timeMax=${encodeURIComponent(timeMax)}`
    + `&singleEvents=true`
    + `&orderBy=startTime`
    + `&maxResults=500`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return []; // skip calendars we can't read

  const data = await resp.json();
  return (data.items || [])
    .filter(item => item.status !== 'cancelled')
    .map(item => ({
      id:     item.id,
      title:  (item.summary || '').trim() || '(sans titre)',
      start:  item.start?.date || item.start?.dateTime?.split('T')[0] || '',
      end:    item.end?.date   || item.end?.dateTime?.split('T')[0]   || '',
      color:  item.colorId ? (GCAL_COLORS[item.colorId] || calColor || gcalConfig.color)
                           : (calColor || gcalConfig.color),
      allDay: !!item.start?.date,
      time:   item.start?.dateTime ? item.start.dateTime.split('T')[1]?.slice(0,5) : '',
      location: item.location || '',
    }));
}

const GCAL_COLORS = {
  '1':'#a4bdfc','2':'#7ae28c','3':'#dbadff','4':'#ff887c',
  '5':'#fbd75b','6':'#ffb878','7':'#46d6db','8':'#e1e1e1',
  '9':'#5484ed','10':'#51b749','11':'#dc2127',
};

// ── INJECT INTO CALENDAR CELLS ────────
function injectEventsIntoCalendars() {
  document.querySelectorAll('.cal-day').forEach(cell => {
    cell.querySelectorAll('.gcal-event').forEach(e => e.remove());
    const m = cell.dataset.month;
    const y = cell.dataset.year;
    const d = cell.dataset.day;
    if (!m || !y || !d) return;

    const dateStr = `${y}-${String(parseInt(m)+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    const dayEvents = gcalEvents.filter(ev => {
      if (!ev.start) return false;
      if (ev.allDay) return ev.start <= dateStr && dateStr < (ev.end || ev.start);
      return ev.start === dateStr;
    });

    dayEvents.slice(0, 3).forEach(ev => {
      const div = document.createElement('div');
      div.className = 'gcal-event';
      div.style.background = ev.color;
      div.textContent = ev.time ? `${ev.time} ${ev.title}` : ev.title;
      div.title = ev.title + (ev.location ? ` 📍 ${ev.location}` : '');
      cell.appendChild(div);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement('div');
      more.className = 'gcal-event';
      more.style.background = '#94A3B8';
      more.textContent = `+${dayEvents.length - 3} autres`;
      cell.appendChild(more);
    }
  });
}

// ── TAG CELLS WITH DATE DATA ──────────
function tagCalendarCells() {
  const schoolYear = parseInt(state.meta.year.split('-')[0]) || 2025;
  const periodMap = {
    p1:[8,9], p2:[10,11], p3:[0,1], p4:[2,3], p5:[4,5],
    annuel:[8,9,10,11,0,1,2,3,4,5]
  };
  Object.entries(periodMap).forEach(([pid, months]) => {
    const wrap = document.getElementById(`calend-${pid}`);
    if (!wrap) return;
    const grids = wrap.querySelectorAll('.calendar-grid');
    months.forEach((m, gi) => {
      if (grids[gi]) tagGridCells(grids[gi], m, m >= 8 ? schoolYear : schoolYear + 1);
    });
  });
  const todoMap = {rentree:7,sep:8,oct:9,nov:10,dec:11,jan:0,fev:1,mar:2,avr:3,mai:4,juin:5,juil:6};
  Object.entries(todoMap).forEach(([mk, m]) => {
    const grid = document.querySelector(`#todo-${mk} .calendar-grid`);
    if (grid) tagGridCells(grid, m, m >= 8 ? schoolYear : schoolYear + 1);
  });
  if (gcalEvents.length > 0) injectEventsIntoCalendars();
}

function tagGridCells(grid, monthIdx, year) {
  const firstDay  = new Date(year, monthIdx, 1).getDay();
  const startDay  = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  let counter = 1 - startDay;
  grid.querySelectorAll('.cal-day').forEach(cell => {
    if (counter >= 1 && counter <= daysInMonth) {
      cell.dataset.month = monthIdx;
      cell.dataset.year  = year;
      cell.dataset.day   = counter;
    }
    counter++;
  });
}

// ── UI HELPERS ────────────────────────
function updateGCalBtnDot(connected) {
  const btn = document.getElementById('gcal-btn');
  if (!btn) return;
  btn.querySelector('.gcal-connected-dot')?.remove();
  if (connected) {
    const dot = document.createElement('span');
    dot.className = 'gcal-connected-dot';
    btn.appendChild(dot);
  }
}

function showSyncBar(show) {
  const bar = document.getElementById('gcal-syncbar');
  if (!bar) return;
  bar.classList.toggle('hidden', !show);
  if (show) {
    const name = gcalConfig.userName || gcalConfig.userEmail || 'Google';
    document.getElementById('gcal-syncbar-text').textContent =
      `📅 ${name} — sync ${gcalConfig.lastSync || ''}`;
  }
}

function disconnectGCal() {
  if (!confirm('Déconnecter Google Agenda ?')) return;
  gcalConfig = { clientId: gcalConfig.clientId, opts:{calend:true,todo:true}, color:'#4285F4', connected:false, accessToken:null, tokenExpiry:null, userEmail:'', userName:'', userAvatar:'' };
  localStorage.setItem('cahier_gcal', JSON.stringify(gcalConfig));
  gcalEvents = [];
  updateGCalBtnDot(false);
  showSyncBar(false);
  document.querySelectorAll('.gcal-event').forEach(e => e.remove());
  closeGCalConfig();
  showToast('🔌 Google Agenda déconnecté');
}

// ── INIT ──────────────────────────────
function initGCal() {
  checkOAuthRedirect();
  loadGCalConfig();
  if (gcalConfig.connected && gcalConfig.accessToken && !isTokenExpired()) {
    updateGCalBtnDot(true);
    showSyncBar(true);
    setTimeout(() => syncGCal(), 1500);
  }
}

// ══════════════════════════════════════
// RÉPARTITION EN GROUPES / ATELIERS
// ══════════════════════════════════════
function addGroupe(ci, data=null) {
  const grid = document.getElementById(`groupes-grid-${ci}`);
  if (!grid) return;
  const gid = Date.now();
  const d = data || { name: `Groupe ${grid.children.length+1}`, color: '#3B82F6', eleves: '' };
  const card = document.createElement('div');
  card.className = 'groupe-card';
  card.dataset.gid = gid;
  card.innerHTML = `
    <div class="groupe-card-header">
      <input class="groupe-name-input" type="text" value="${d.name}" placeholder="Nom du groupe…"
        oninput="saveGroupes(${ci})">
      <input type="color" class="groupe-color" value="${d.color||'#3B82F6'}"
        onchange="this.closest('.groupe-card').style.borderColor=this.value;saveGroupes(${ci})">
      <button style="background:none;border:none;color:#FCA5A5;cursor:pointer;font-size:18px"
        onclick="this.closest('.groupe-card').remove();saveGroupes(${ci})" title="Supprimer">×</button>
    </div>
    <textarea style="width:100%;border:1.5px solid #E2E8F0;border-radius:8px;padding:8px;font-family:'Caveat',cursive;font-size:14px;resize:vertical;min-height:80px"
      placeholder="Noms des élèves (un par ligne ou séparés par virgule)…"
      oninput="saveGroupes(${ci})">${d.eleves||''}</textarea>
    <div style="font-size:11px;color:#94A3B8;margin-top:4px" id="groupe-count-${gid}"></div>`;
  card.style.borderColor = d.color || '#3B82F6';
  grid.appendChild(card);
  // Count eleves
  const ta = card.querySelector('textarea');
  ta.addEventListener('input', () => updateGroupeCount(card, gid));
  updateGroupeCount(card, gid);
}

function updateGroupeCount(card, gid) {
  const ta = card.querySelector('textarea');
  const count = ta.value.split(/[\n,]/).map(s=>s.trim()).filter(Boolean).length;
  const el = document.getElementById(`groupe-count-${gid}`);
  if (el) el.textContent = count > 0 ? `${count} élève${count>1?'s':''}` : '';
}

function saveGroupes(ci) {
  const grid = document.getElementById(`groupes-grid-${ci}`);
  if (!grid) return;
  const groupes = [...grid.querySelectorAll('.groupe-card')].map(card => ({
    name:   card.querySelector('.groupe-name-input')?.value || '',
    color:  card.querySelector('.groupe-color')?.value || '#3B82F6',
    eleves: card.querySelector('textarea')?.value || '',
  }));
  setData(`admin.effectifs.groupes.c${ci}`, groupes);
  debounceSave();
}

function loadGroupes(ci) {
  const grid = document.getElementById(`groupes-grid-${ci}`);
  if (!grid) return;
  grid.innerHTML = '';
  const saved = getData(`admin.effectifs.groupes.c${ci}`) || [];
  if (saved.length === 0) {
    addGroupe(ci, { name:'Groupe A', color:'#3B82F6', eleves:'' });
    addGroupe(ci, { name:'Groupe B', color:'#10B981', eleves:'' });
  } else {
    saved.forEach(g => addGroupe(ci, g));
  }
}

// ══════════════════════════════════════
// DOCS ADM — COLONNES DYNAMIQUES
// ══════════════════════════════════════
const DOCSADM_DEFAULT_COLS = [
  'Fiche renseign.','Sorties t.scol.','PAI','Fiches urgence',
  'Droit image','Charte internet','APC','Assurance','Règlement int.'
];

function buildDocsAdmTable() {
  const wrap = document.getElementById('docsadm-table-wrap');
  if (!wrap) return;
  const cols = getData('classe.docsadm.cols') || DOCSADM_DEFAULT_COLS;
  const rows = getData('classe.docsadm.rows') || [];

  wrap.innerHTML = `
    <table class="data-table" id="docsadm-table">
      <thead>
        <tr>
          <th style="min-width:150px">Élève</th>
          ${cols.map((c,ci) => `
            <th class="th-rot">
              <div class="docsadm-col-header">
                <input type="text" value="${c}" placeholder="Colonne…"
                  onchange="renameDocsAdmCol(${ci},this.value)">
                <button class="docsadm-del-col" onclick="deleteDocsAdmCol(${ci})" title="Supprimer">×</button>
              </div>
            </th>`).join('')}
          <th class="no-print"></th>
        </tr>
      </thead>
      <tbody id="classe-docsadm-body"></tbody>
    </table>`;

  // Load rows
  if (rows.length === 0) {
    for (let i = 0; i < 3; i++) addDocsAdmRow();
  } else {
    rows.forEach(row => addDocsAdmRow(row.name, row.checks));
  }
}

function addDocsAdmRow(name='', checks=[]) {
  const body = document.getElementById('classe-docsadm-body');
  if (!body) return;
  const cols = getData('classe.docsadm.cols') || DOCSADM_DEFAULT_COLS;
  const tr = document.createElement('tr');
  let cells = `<td><input type="text" value="${name}" placeholder="Nom élève…"
    style="min-width:130px;border:none;padding:8px 10px;font-weight:700"
    oninput="saveDocsAdm()"></td>`;
  cols.forEach((_,ci) => {
    cells += `<td style="text-align:center"><input type="checkbox" ${checks[ci]?'checked':''}
      onchange="saveDocsAdm()"></td>`;
  });
  cells += `<td class="no-print"><button class="delete-row-btn"
    onclick="this.closest('tr').remove();saveDocsAdm()">×</button></td>`;
  tr.innerHTML = cells;
  body.appendChild(tr);
}

function saveDocsAdm() {
  const body = document.getElementById('classe-docsadm-body');
  if (!body) return;
  const rows = [...body.querySelectorAll('tr')].map(tr => ({
    name: tr.querySelector('input[type=text]')?.value || '',
    checks: [...tr.querySelectorAll('input[type=checkbox]')].map(c => c.checked),
  }));
  setData('classe.docsadm.rows', rows);
  debounceSave();
}

function addDocsAdmCol() {
  const cols = getData('classe.docsadm.cols') || DOCSADM_DEFAULT_COLS;
  cols.push('Nouveau doc');
  setData('classe.docsadm.cols', cols);
  buildDocsAdmTable();
  debounceSave();
}

function renameDocsAdmCol(ci, name) {
  const cols = getData('classe.docsadm.cols') || DOCSADM_DEFAULT_COLS;
  cols[ci] = name;
  setData('classe.docsadm.cols', cols);
  debounceSave();
}

function deleteDocsAdmCol(ci) {
  if (!confirm('Supprimer cette colonne ?')) return;
  const cols = getData('classe.docsadm.cols') || DOCSADM_DEFAULT_COLS;
  cols.splice(ci, 1);
  setData('classe.docsadm.cols', cols);
  // Also trim checks in rows
  const rows = getData('classe.docsadm.rows') || [];
  rows.forEach(r => { if (r.checks) r.checks.splice(ci,1); });
  setData('classe.docsadm.rows', rows);
  buildDocsAdmTable();
  debounceSave();
}

// Patch importExcelToDocsAdm to use new system
function importExcelToDocsAdm(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type:'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      const existing = getData('classe.docsadm.rows') || [];
      rawRows.forEach((row, i) => {
        if (i === 0 && /nom|prénom|élève/i.test(String(row[0]))) return;
        const nom = [row[0],row[1]].filter(Boolean).join(' ').trim() || String(row[0]);
        if (!nom) return;
        existing.push({ name: nom, checks: [] });
      });
      setData('classe.docsadm.rows', existing);
      buildDocsAdmTable();
      showToast(`✅ ${rawRows.length} élèves importés !`);
    } catch { showToast('⚠️ Erreur de lecture'); }
  };
  reader.readAsBinaryString(file);
}

// ══════════════════════════════════════
// IDENTIFIANTS & MOTS DE PASSE
// ══════════════════════════════════════
function addIdentifiantRow(data=null) {
  const body = document.getElementById('identifiants-body');
  if (!body) return;
  const d = data || {};
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" value="${d.site||''}" placeholder="Ex: ONDE, Educonnect…" style="min-width:140px;border:none;padding:8px 10px;font-weight:700" oninput="saveIdentifiants()"></td>
    <td><input type="text" value="${d.url||''}" placeholder="https://…" style="min-width:180px;border:none;padding:8px 10px;color:#2563EB" oninput="saveIdentifiants()"></td>
    <td><input type="text" value="${d.login||''}" placeholder="Identifiant…" style="min-width:140px;border:none;padding:8px 10px" oninput="saveIdentifiants()"></td>
    <td class="mdp-cell">
      <div style="display:flex;align-items:center;gap:6px">
        <input type="password" value="${d.mdp||''}" placeholder="Mot de passe…" style="min-width:130px;border:none;padding:8px 10px;flex:1" oninput="saveIdentifiants()">
        <button type="button" onclick="toggleMdpVisibility(this)" style="background:none;border:1.5px solid #E2E8F0;border-radius:6px;padding:4px 7px;cursor:pointer;font-size:14px" title="Afficher/masquer">👁</button>
      </div>
    </td>
    <td><input type="text" value="${d.notes||''}" placeholder="Notes…" style="min-width:110px;border:none;padding:8px 10px" oninput="saveIdentifiants()"></td>
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveIdentifiants()">×</button></td>
  `;
  body.appendChild(tr);
}

function toggleMdpVisibility(btn) {
  const inp = btn.previousElementSibling;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

function saveIdentifiants() {
  const rows = [...document.querySelectorAll('#identifiants-body tr')].map(tr => {
    const inputs = tr.querySelectorAll('input');
    return { site:inputs[0]?.value||'', url:inputs[1]?.value||'', login:inputs[2]?.value||'', mdp:inputs[3]?.value||'', notes:inputs[4]?.value||'' };
  });
  setData('gen.identifiants', rows);
  debounceSave();
}

function loadIdentifiants() {
  const body = document.getElementById('identifiants-body');
  if (!body || body.children.length > 0) return;
  const saved = getData('gen.identifiants') || [];
  if (saved.length === 0) { for (let i = 0; i < 3; i++) addIdentifiantRow(); }
  else saved.forEach(r => addIdentifiantRow(r));
}

// ══════════════════════════════════════
// INDICATEURS PAR PÉRIODE
// ══════════════════════════════════════
const INDICATEURS_DATA = [
  {
    cat: 'Co-éducation et partenaires',
    color: '#FDA4AF',
    indicateurs: [
      'Taux participation élections RPE',
      'Taux connexion ENT',
      'Participation des familles',
      'Actions en co-éducation',
      'Intervenants extérieurs',
    ]
  },
  {
    cat: 'Parcours',
    color: '#FCD34D',
    indicateurs: [
      'Projet parcours citoyen',
      'Projet parcours santé',
      'Projet PEAC',
    ]
  },
  {
    cat: 'Climat scolaire et bien être des élèves',
    color: '#FBCFE8',
    indicateurs: [
      'Faits établissements',
      'Situations de harcèlement',
      'Suivis services sociaux',
      'Signalements',
      'IP',
      'AESH',
      'Taux de fréquentation',
    ]
  },
  {
    cat: 'Résultats et parcours scolaires',
    color: '#A7F3D0',
    indicateurs: [
      'Taux de réussite évaluations nationales',
      'Élèves en difficulté (PPRE)',
      'Élèves PAI',
      'Orientations',
      'Redoublements',
      'Absentéisme élèves',
    ]
  },
  {
    cat: 'Équipe enseignante',
    color: '#BAE6FD',
    indicateurs: [
      'Absentéisme enseignants',
      'Remplacements effectués',
      'Formations suivies',
      'Conseils de maîtres tenus',
      'Conseils de cycle tenus',
    ]
  },
];

const PERIODES = ['P1', 'P2', 'P3', 'P4', 'P5'];

function buildIndicateurs() {
  const container = document.getElementById('indicateurs-container');
  if (!container || container.innerHTML.trim()) return;

  let html = `
    <div class="indic-toolbar no-print" style="margin-bottom:16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn-xs" onclick="addIndicateurLigne()">+ Ajouter un indicateur</button>
      <span class="hint" style="margin:0">Cliquez sur une cellule pour saisir une valeur.</span>
    </div>
    <div class="table-wrap">
    <table class="data-table indic-table" id="indic-table">
      <thead>
        <tr>
          <th class="indic-name-col">Indicateur</th>
          ${PERIODES.map(p => `<th class="indic-p-col">${p}</th>`).join('')}
          <th class="no-print" style="width:32px"></th>
        </tr>
      </thead>
      <tbody id="indic-body">`;

  const saved = getData('admin.indicateurs') || {};
  INDICATEURS_DATA.forEach(groupe => {
    // Category header row
    html += `<tr class="indic-cat-row">
      <td colspan="${PERIODES.length + 2}" class="indic-cat-header" style="background:${groupe.color};font-weight:900;font-size:13px;padding:8px 14px;letter-spacing:0.03em">
        ${groupe.cat}
      </td>
    </tr>`;
    // Indicateur rows
    groupe.indicateurs.forEach(indic => {
      html += `<tr data-cat="${groupe.cat}" data-indic="${indic}">`;
      html += `<td class="indic-name-cell" style="background:${groupe.color}22;font-size:12px;font-weight:600;padding:6px 14px;min-width:180px">${indic}</td>`;
      PERIODES.forEach(p => {
        const key = `${groupe.cat}||${indic}||${p}`;
        const val = saved[key] || '';
        html += `<td class="indic-val-cell"><input type="text" value="${val}" placeholder="—"
          data-ikey="${key}"
          style="width:100%;border:none;text-align:center;padding:6px 4px;font-family:var(--font);font-size:13px;background:transparent"
          oninput="saveIndicateurCell(this)"></td>`;
      });
      html += `<td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveIndicateurs()" title="Supprimer">×</button></td>`;
      html += `</tr>`;
    });
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;

  const extra = getData('admin.indicateurs.extra') || [];
  extra.forEach(r => addIndicateurLigneFromData(r));
  reloadIndicateurValues();
}

function reloadIndicateurValues() {
  const saved = getData('admin.indicateurs') || {};
  document.querySelectorAll('#indic-body input[data-ikey]').forEach(inp => {
    const v = saved[inp.dataset.ikey];
    if (v !== undefined) inp.value = v;
  });
}

function saveIndicateurCell(inp) {
  const saved = getData('admin.indicateurs') || {};
  saved[inp.dataset.ikey] = inp.value;
  setData('admin.indicateurs', saved);
  debounceSave();
}

function saveIndicateurs() {
  // Save editable category/indicateur names and cell values
  const saved = getData('admin.indicateurs') || {};
  document.querySelectorAll('#indic-body input[data-ikey]').forEach(inp => {
    saved[inp.dataset.ikey] = inp.value;
  });
  setData('admin.indicateurs', saved);
  debounceSave();
}

function addIndicateurLigne() {
  const cat = prompt('Catégorie (existante ou nouvelle) :', 'Autre');
  if (!cat) return;
  const indic = prompt('Nom de l\'indicateur :', '');
  if (!indic) return;
  addIndicateurLigneFromData({ cat, indic });
  // Save extra rows
  const extra = getData('admin.indicateurs.extra') || [];
  extra.push({ cat, indic });
  setData('admin.indicateurs.extra', extra);
  debounceSave();
}

function addIndicateurLigneFromData({ cat, indic }) {
  const body = document.getElementById('indic-body');
  if (!body) return;
  const saved = getData('admin.indicateurs') || {};
  const tr = document.createElement('tr');
  tr.dataset.cat = cat;
  tr.dataset.indic = indic;
  tr.innerHTML = `
    <td class="indic-cat-cell" style="background:#E2E8F050;font-size:11px;font-weight:700;padding:6px 8px;color:#64748B">${cat}</td>
    <td class="indic-name-cell" style="font-size:12px;font-weight:700;padding:6px 10px">
      <span contenteditable="true" spellcheck="false" onblur="saveIndicateurs()">${indic}</span>
    </td>
    ${PERIODES.map(p => {
      const key = `${cat}||${indic}||${p}`;
      return `<td class="indic-val-cell"><input type="text" value="${saved[key]||''}" placeholder="—"
        data-ikey="${key}"
        style="width:100%;border:none;text-align:center;padding:6px 4px;font-family:var(--font);font-size:13px;background:transparent"
        oninput="saveIndicateurCell(this)"></td>`;
    }).join('')}
    <td class="no-print"><button class="delete-row-btn" onclick="this.closest('tr').remove();saveIndicateurs()">×</button></td>
  `;
  body.appendChild(tr);
}

// ══════════════════════════════════════
// PARAMÈTRES — modifier nom/école
// ══════════════════════════════════════
function openSettings() {
  const modal = document.getElementById('settings-modal');
  document.getElementById('settings-name').value   = state.meta.name   || '';
  document.getElementById('settings-school').value = state.meta.school || '';
  const sel = document.getElementById('settings-year');
  sel.value = state.meta.year || '2025-2026';
  modal.style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

function saveSettings() {
  const name   = document.getElementById('settings-name').value.trim();
  const school = document.getElementById('settings-school').value.trim();
  const year   = document.getElementById('settings-year').value;
  if (!school) { alert('Le nom de l\'école ne peut pas être vide.'); return; }
  state.meta.name   = name;
  state.meta.school = school;
  state.meta.year   = year;
  localStorage.setItem('cahier_meta', JSON.stringify(state.meta));
  // Update display
  document.getElementById('topbar-info').textContent    = `${school} — ${year}`;
  document.getElementById('sidebar-school').textContent = school;
  document.getElementById('sidebar-year').textContent   = year;
  closeSettings();
  showToast('✅ Paramètres enregistrés !');
}

// Fermer la modale en cliquant en dehors
document.addEventListener('click', e => {
  const modal = document.getElementById('settings-modal');
  if (modal && e.target === modal) closeSettings();
});
