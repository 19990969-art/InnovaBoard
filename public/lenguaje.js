let temas=[],lecciones=[],actividades=[];
const headers={};

async function api(url,options={}){options.headers={...(options.headers||{}),...headers};const r=await fetch(url,options);if(r.status===401){throw new Error('No se pudo acceder a los datos')}const d=await r.json();if(!r.ok)throw new Error(d.error||'Error');return d}

async function init(){
  try{
    const user=await api('/api/auth/me');
    document.getElementById('name').textContent=user.nombre;
    document.getElementById('level').textContent=`Nivel ${user.nivel}`;
    document.getElementById('avatar').textContent=user.nombre.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
    [temas,lecciones,actividades]=await Promise.all([
      api('/api/lenguaje/temas'),api('/api/lenguaje/lecciones'),api('/api/lenguaje/actividades')
    ]);
    renderTemas();renderLecciones();renderActividades();await cargarProgreso();
    // Iniciar una sesión real de estudio al entrar.
    await api('/api/estudio/iniciar',{method:'POST'});
  }catch(e){console.error(e)}
}

function renderTemas(){const q=(document.getElementById('search').value||'').toLowerCase();const c=document.getElementById('topics');c.innerHTML='';temas.filter(t=>t.nombre.toLowerCase().includes(q)).forEach(t=>{const el=document.createElement('article');el.className='topic';el.innerHTML=`<div class="card-meta">${t.total_lecciones} lecciones</div><h3>${esc(t.nombre)}</h3><p>${esc(t.descripcion)}</p><div class="mini"><div style="width:${t.porcentaje}%"></div></div><div class="card-meta" style="margin-top:7px">${t.lecciones_completadas}/${t.total_lecciones} completadas · ${t.porcentaje}%</div>`;c.appendChild(el)})}

function renderLecciones(){const c=document.getElementById('lessonsGrid');c.innerHTML='';lecciones.forEach(l=>{const el=document.createElement('article');el.className='lesson';el.innerHTML=`<div class="row"><div><div class="card-meta">${esc(l.tema)}</div><h3>${esc(l.titulo)}</h3></div><span>${l.completada?'✅':'⬜'}</span></div><p>${esc(l.contenido)}</p><button class="small-btn ${l.completada?'done':''}" onclick="completarLeccion(${l.id})">${l.completada?'Completada':'Marcar como aprendida'}</button>`;c.appendChild(el)})}

function renderActividades(){const c=document.getElementById('activitiesGrid');c.innerHTML='';actividades.forEach(a=>{const el=document.createElement('article');el.className='activity';el.innerHTML=`<div class="card-meta">${esc(a.tipo)}</div><h3>${esc(a.titulo)}</h3><p>${esc(a.descripcion)}</p><button class="small-btn ${a.realizada?'done':''}" onclick="realizarActividad(${a.id})">${a.realizada?'✅ Realizada':'Realizar actividad'}</button>`;c.appendChild(el)})}

async function completarLeccion(id){await api(`/api/lenguaje/lecciones/${id}/completar`,{method:'POST'});lecciones=await api('/api/lenguaje/lecciones');temas=await api('/api/lenguaje/temas');renderLecciones();renderTemas();await cargarProgreso()}
async function realizarActividad(id){await api(`/api/lenguaje/actividades/${id}/realizar`,{method:'POST'});actividades=await api('/api/lenguaje/actividades');renderActividades();await cargarProgreso()}
async function cargarProgreso(){const p=await api('/api/lenguaje/progreso');document.getElementById('progressPct').textContent=`${p.porcentaje}%`;document.getElementById('progressBar').style.width=`${p.porcentaje}%`;document.getElementById('lessons').textContent=`${p.lecciones_completadas}/${p.total_lecciones}`;document.getElementById('activities').textContent=`${p.actividades_realizadas}/${p.total_actividades}`;document.getElementById('time').textContent=formatTime(p.tiempo_estudio_segundos)}
function formatTime(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return `${h}h ${m}m`}
function continuar(){document.getElementById('lessonsGrid').scrollIntoView({behavior:'smooth'})}
function irClases(){entrarClase()}
async function entrarClase(){const codigo=prompt('Ingresa el código de la clase:','LEN-2026');if(!codigo)return;try{const d=await api('/api/clases/entrar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codigo})});alert(`✅ Entraste a: ${d.clase.nombre}`)}catch(e){alert(e.message)}}
function abrirBoard(){abrirModal(`<span class="tag">BOARD</span><h2>Asistente de Lenguaje</h2><p style="color:#777">Escribe una pregunta para solicitar una explicación o ejemplo.</p><textarea id="question" rows="5" placeholder="¿Qué es un texto argumentativo?"></textarea><button class="action" onclick="preguntarBoard()">Preguntar</button><div id="boardAnswer" style="margin-top:15px;color:#555"></div>`)}
async function preguntarBoard(){const q=document.getElementById('question').value.trim(),out=document.getElementById('boardAnswer');if(!q){out.textContent='Escribe una pregunta.';return}out.textContent='Consultando Board...';try{const r=await fetch('/api/board',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({pregunta:q,materia:'Lenguaje'})});const d=await r.json();out.textContent=r.ok?(d.respuesta||'Respuesta recibida.'):'Board no está disponible en este momento.'}catch{out.textContent='Board no está disponible en este momento.'}}
function abrirModal(html){document.getElementById('modalContent').innerHTML=html;document.getElementById('modal').classList.add('show')}
function cerrarModal(){document.getElementById('modal').classList.remove('show')}
function esc(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
window.addEventListener('beforeunload',()=>{navigator.sendBeacon('/api/estudio/finalizar',new Blob([JSON.stringify({})],{type:'application/json'}))});
init();