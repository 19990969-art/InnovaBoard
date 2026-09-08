const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { db, hashPassword } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const sessions = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  const userId = token ? sessions.get(token) : 1;
  req.userId = userId;
  next();
}

function makeToken() { return crypto.randomBytes(32).toString('hex'); }

function getStudySeconds(userId, done) {
  db.get(`SELECT COALESCE(SUM(segundos),0) AS total FROM sesiones_estudio WHERE usuario_id=?`, [userId], (e,row)=>done(e,row?.total||0));
}

app.post('/api/auth/login', (req,res)=>{
  const { correo, password } = req.body;
  if (!correo || !password) return res.status(400).json({ error:'Correo y contraseña son obligatorios' });
  db.get(`SELECT id,nombre,correo,nivel,password_hash FROM usuarios WHERE correo=?`, [correo.trim().toLowerCase()], (e,user)=>{
    if (e) return res.status(500).json({error:e.message});
    if (!user || user.password_hash !== hashPassword(password)) return res.status(401).json({error:'Credenciales incorrectas'});
    const token=makeToken(); sessions.set(token,user.id);
    delete user.password_hash;
    res.json({ token, usuario:user });
  });
});

app.post('/api/auth/logout', auth, (req,res)=>{
  const token=req.headers.authorization?.replace('Bearer ','');
  if(token) sessions.delete(token);
  res.json({success:true});
});

app.get('/api/auth/me', auth, (req,res)=>{
  db.get(`SELECT id,nombre,correo,nivel FROM usuarios WHERE id=?`,[req.userId],(e,row)=>{
    if(e) return res.status(500).json({error:e.message});
    res.json(row);
  });
});

app.get('/api/lenguaje/temas', auth, (req,res)=>{
  const sql=`SELECT t.id,t.nombre,t.descripcion,t.total_lecciones,
    (SELECT COUNT(*) FROM lecciones_completadas lc JOIN lecciones l ON l.id=lc.leccion_id WHERE lc.usuario_id=? AND l.tema_id=t.id) AS lecciones_completadas
    FROM temas t WHERE t.materia_id=1 ORDER BY t.id`;
  db.all(sql,[req.userId],(e,rows)=>{
    if(e) return res.status(500).json({error:e.message});
    res.json(rows.map(r=>({...r, porcentaje:r.total_lecciones?Math.round(r.lecciones_completadas/r.total_lecciones*100):0})));
  });
});

app.get('/api/lenguaje/lecciones', auth, (req,res)=>{
  const sql=`SELECT l.id,l.tema_id,l.titulo,l.contenido,
    CASE WHEN lc.id IS NULL THEN 0 ELSE 1 END AS completada,
    t.nombre AS tema
    FROM lecciones l JOIN temas t ON t.id=l.tema_id
    LEFT JOIN lecciones_completadas lc ON lc.leccion_id=l.id AND lc.usuario_id=?
    WHERE t.materia_id=1 ORDER BY l.tema_id,l.id`;
  db.all(sql,[req.userId],(e,rows)=> e ? res.status(500).json({error:e.message}) : res.json(rows));
});

app.post('/api/lenguaje/lecciones/:id/completar', auth, (req,res)=>{
  db.run(`INSERT OR IGNORE INTO lecciones_completadas(usuario_id,leccion_id) VALUES(?,?)`,[req.userId,Number(req.params.id)],e=>{
    if(e) return res.status(500).json({error:e.message});
    res.json({success:true});
  });
});

app.get('/api/lenguaje/actividades', auth, (req,res)=>{
  const sql=`SELECT a.id,a.titulo,a.descripcion,a.tipo,
    CASE WHEN ar.id IS NULL THEN 0 ELSE 1 END AS realizada
    FROM actividades a
    LEFT JOIN actividades_realizadas ar ON ar.actividad_id=a.id AND ar.usuario_id=?
    WHERE a.materia_id=1 ORDER BY a.id`;
  db.all(sql,[req.userId],(e,rows)=> e ? res.status(500).json({error:e.message}) : res.json(rows));
});

app.post('/api/lenguaje/actividades/:id/realizar', auth, (req,res)=>{
  db.run(`INSERT OR IGNORE INTO actividades_realizadas(usuario_id,actividad_id) VALUES(?,?)`,[req.userId,Number(req.params.id)],e=>{
    if(e) return res.status(500).json({error:e.message});
    res.json({success:true});
  });
});

app.get('/api/lenguaje/progreso', auth, (req,res)=>{
  const sql=`SELECT
    (SELECT COUNT(*) FROM lecciones WHERE tema_id IN (SELECT id FROM temas WHERE materia_id=1)) total_lecciones,
    (SELECT COUNT(*) FROM lecciones_completadas lc JOIN lecciones l ON l.id=lc.leccion_id JOIN temas t ON t.id=l.tema_id WHERE lc.usuario_id=? AND t.materia_id=1) lecciones_completadas,
    (SELECT COUNT(*) FROM actividades WHERE materia_id=1) total_actividades,
    (SELECT COUNT(*) FROM actividades_realizadas ar JOIN actividades a ON a.id=ar.actividad_id WHERE ar.usuario_id=? AND a.materia_id=1) actividades_realizadas`; 
  db.get(sql,[req.userId,req.userId],(e,row)=>{
    if(e) return res.status(500).json({error:e.message});
    getStudySeconds(req.userId,(e2,seconds)=>{
      if(e2) return res.status(500).json({error:e2.message});
      const porcentaje=row.total_lecciones?Math.round(row.lecciones_completadas/row.total_lecciones*100):0;
      res.json({...row,porcentaje,tiempo_estudio_segundos:seconds});
    });
  });
});

app.post('/api/estudio/iniciar', auth, (req,res)=>{
  db.run(`UPDATE sesiones_estudio SET activa=0 WHERE usuario_id=? AND activa=1`,[req.userId],()=>{
    db.run(`INSERT INTO sesiones_estudio(usuario_id,inicio,activa) VALUES(?,datetime('now'),1)`,[req.userId],function(e){
      if(e) return res.status(500).json({error:e.message});
      res.json({success:true,sessionId:this.lastID,inicio:new Date().toISOString()});
    });
  });
});

app.post('/api/estudio/finalizar', auth, (req,res)=>{
  db.get(`SELECT id,inicio FROM sesiones_estudio WHERE usuario_id=? AND activa=1 ORDER BY id DESC LIMIT 1`,[req.userId],(e,s)=>{
    if(e) return res.status(500).json({error:e.message});
    if(!s) return res.json({success:true,segundos:0});
    db.run(`UPDATE sesiones_estudio SET fin=datetime('now'),segundos=CAST((julianday('now')-julianday(inicio))*86400 AS INTEGER),activa=0 WHERE id=?`,[s.id],function(e2){
      if(e2) return res.status(500).json({error:e2.message});
      res.json({success:true});
    });
  });
});

app.post('/api/clases/entrar', auth, (req,res)=>{
  const codigo=String(req.body.codigo||'').trim().toUpperCase();
  if(!codigo) return res.status(400).json({error:'Ingresa el código de clase'});
  db.get(`SELECT id,codigo,nombre,materia_id FROM clases WHERE codigo=? AND activa=1`,[codigo],(e,c)=>{
    if(e) return res.status(500).json({error:e.message});
    if(!c) return res.status(404).json({error:'Código de clase no válido'});
    db.run(`INSERT OR IGNORE INTO asistencia(clase_id,usuario_id) VALUES(?,?)`,[c.id,req.userId],e2=>{
      if(e2) return res.status(500).json({error:e2.message});
      res.json({success:true,clase:c});
    });
  });
});

app.post('/api/clases/salir', auth, (req,res)=>{
  db.get(`SELECT id FROM asistencia WHERE usuario_id=? AND salida IS NULL ORDER BY id DESC LIMIT 1`,[req.userId],(e,a)=>{
    if(e) return res.status(500).json({error:e.message});
    if(!a) return res.json({success:true});
    db.run(`UPDATE asistencia SET salida=datetime('now') WHERE id=?`,[a.id],e2=> e2?res.status(500).json({error:e2.message}):res.json({success:true}));
  });
});

app.get('/api/clases/asistencia', auth, (req,res)=>{
  db.all(`SELECT c.nombre,c.codigo,a.entrada,a.salida FROM asistencia a JOIN clases c ON c.id=a.clase_id WHERE a.usuario_id=? ORDER BY a.id DESC LIMIT 10`,[req.userId],(e,rows)=> e?res.status(500).json({error:e.message}):res.json(rows));
});

app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','lenguaje.html')));
app.listen(PORT, '0.0.0.0', ()=>console.log(`InnovaBoard funcionando en el puerto ${PORT}`));