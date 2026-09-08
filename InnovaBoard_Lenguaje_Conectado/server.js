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
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
  const userId = token ? sessions.get(token) : null;
  if (!userId) return res.status(401).json({ error: 'No autenticado' });
  req.userId = userId;
  req.token = token;
  next();
}

function makeToken() { return crypto.randomBytes(32).toString('hex'); }

function getStudySeconds(userId, done) {
  db.get(`SELECT COALESCE(SUM(segundos),0) AS total FROM sesiones_estudio WHERE usuario_id=?`, [userId],
    (e, row) => done(e, row ? Number(row.total) : 0));
}

function getLanguageProgress(userId, done) {
  const sql = `SELECT
    (SELECT COUNT(*) FROM lecciones l JOIN temas t ON t.id=l.tema_id WHERE t.materia_id=1) AS total_lecciones,
    (SELECT COUNT(*) FROM lecciones_completadas lc JOIN lecciones l ON l.id=lc.leccion_id JOIN temas t ON t.id=l.tema_id WHERE lc.usuario_id=? AND t.materia_id=1) AS lecciones_completadas,
    (SELECT COUNT(*) FROM actividades a WHERE a.materia_id=1) AS total_actividades,
    (SELECT COUNT(*) FROM actividades_realizadas ar JOIN actividades a ON a.id=ar.actividad_id WHERE ar.usuario_id=? AND a.materia_id=1) AS actividades_realizadas`;
  db.get(sql, [userId, userId], (e, row) => {
    if (e) return done(e);
    getStudySeconds(userId, (e2, seconds) => {
      if (e2) return done(e2);
      const lessons = Number(row.lecciones_completadas || 0);
      const activities = Number(row.actividades_realizadas || 0);
      const totalLessons = Number(row.total_lecciones || 0);
      const points = lessons * 50 + activities * 30;
      const badges = lessons >= 2 ? 1 : 0;
      const percentage = totalLessons ? Math.round(lessons / totalLessons * 100) : 0;
      done(null, {
        total_lecciones: totalLessons,
        lecciones_completadas: lessons,
        total_actividades: Number(row.total_actividades || 0),
        actividades_realizadas: activities,
        porcentaje: percentage,
        puntos: points,
        insignias: badges,
        tiempo_estudio_segundos: Number(seconds || 0)
      });
    });
  });
}

app.post('/api/auth/login', (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
  db.get(`SELECT id,nombre,correo,nivel,password_hash FROM usuarios WHERE correo=?`,
    [String(correo).trim().toLowerCase()], (e, user) => {
      if (e) return res.status(500).json({ error: e.message });
      if (!user || user.password_hash !== hashPassword(password)) return res.status(401).json({ error: 'Credenciales incorrectas' });
      const token = makeToken();
      sessions.set(token, user.id);
      delete user.password_hash;
      res.json({ token, usuario: user });
    });
});

app.post('/api/auth/logout', auth, (req, res) => {
  sessions.delete(req.token);
  res.json({ success: true });
});

app.get('/api/auth/me', auth, (req, res) => {
  db.get(`SELECT id,nombre,correo,nivel FROM usuarios WHERE id=?`, [req.userId], (e, row) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(row);
  });
});

app.get('/api/lenguaje/temas', auth, (req, res) => {
  const sql = `SELECT t.id,t.nombre,t.descripcion,t.total_lecciones,
    (SELECT COUNT(*) FROM lecciones_completadas lc JOIN lecciones l ON l.id=lc.leccion_id WHERE lc.usuario_id=? AND l.tema_id=t.id) AS lecciones_completadas
    FROM temas t WHERE t.materia_id=1 ORDER BY t.id`;
  db.all(sql, [req.userId], (e, rows) => {
    if (e) return res.status(500).json({ error: e.message });
    res.json(rows.map(r => ({ ...r, porcentaje: r.total_lecciones ? Math.round(r.lecciones_completadas / r.total_lecciones * 100) : 0 })));
  });
});

app.get('/api/lenguaje/lecciones', auth, (req, res) => {
  const sql = `SELECT l.id,l.tema_id,l.titulo,l.contenido,
    CASE WHEN lc.id IS NULL THEN 0 ELSE 1 END AS completada,
    t.nombre AS tema
    FROM lecciones l JOIN temas t ON t.id=l.tema_id
    LEFT JOIN lecciones_completadas lc ON lc.leccion_id=l.id AND lc.usuario_id=?
    WHERE t.materia_id=1 ORDER BY l.tema_id,l.id`;
  db.all(sql, [req.userId], (e, rows) => e ? res.status(500).json({ error: e.message }) : res.json(rows));
});

app.post('/api/lenguaje/lecciones/:id/completar', auth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Lección no válida' });
  db.get(`SELECT l.id FROM lecciones l JOIN temas t ON t.id=l.tema_id WHERE l.id=? AND t.materia_id=1`, [id], (e, lesson) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!lesson) return res.status(404).json({ error: 'Lección no encontrada' });
    db.run(`INSERT OR IGNORE INTO lecciones_completadas(usuario_id,leccion_id) VALUES(?,?)`, [req.userId, id], e2 => {
      if (e2) return res.status(500).json({ error: e2.message });
      getLanguageProgress(req.userId, (e3, progress) => {
        if (e3) return res.status(500).json({ error: e3.message });
        res.json({ success: true, progress });
      });
    });
  });
});

app.get('/api/lenguaje/actividades', auth, (req, res) => {
  const sql = `SELECT a.id,a.titulo,a.descripcion,a.tipo,
    CASE WHEN ar.id IS NULL THEN 0 ELSE 1 END AS realizada
    FROM actividades a
    LEFT JOIN actividades_realizadas ar ON ar.actividad_id=a.id AND ar.usuario_id=?
    WHERE a.materia_id=1 ORDER BY a.id`;
  db.all(sql, [req.userId], (e, rows) => e ? res.status(500).json({ error: e.message }) : res.json(rows));
});

app.post('/api/lenguaje/actividades/:id/realizar', auth, (req, res) => {
  const id = Number(req.params.id);
  db.get(`SELECT id FROM actividades WHERE id=? AND materia_id=1`, [id], (e, activity) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!activity) return res.status(404).json({ error: 'Actividad no encontrada' });
    db.run(`INSERT OR IGNORE INTO actividades_realizadas(usuario_id,actividad_id) VALUES(?,?)`, [req.userId, id], e2 => {
      if (e2) return res.status(500).json({ error: e2.message });
      getLanguageProgress(req.userId, (e3, progress) => {
        if (e3) return res.status(500).json({ error: e3.message });
        res.json({ success: true, progress });
      });
    });
  });
});

app.get('/api/lenguaje/progreso', auth, (req, res) => {
  getLanguageProgress(req.userId, (e, progress) => e ? res.status(500).json({ error: e.message }) : res.json(progress));
});

app.post('/api/lenguaje/reiniciar', auth, (req, res) => {
  db.serialize(() => {
    db.run(`DELETE FROM lecciones_completadas WHERE usuario_id=? AND leccion_id IN (SELECT l.id FROM lecciones l JOIN temas t ON t.id=l.tema_id WHERE t.materia_id=1)`, [req.userId]);
    db.run(`DELETE FROM actividades_realizadas WHERE usuario_id=? AND actividad_id IN (SELECT id FROM actividades WHERE materia_id=1)`, [req.userId], e => {
      if (e) return res.status(500).json({ error: e.message });
      getLanguageProgress(req.userId, (e2, progress) => e2 ? res.status(500).json({ error: e2.message }) : res.json({ success: true, progress }));
    });
  });
});

app.post('/api/estudio/iniciar', auth, (req, res) => {
  db.run(`UPDATE sesiones_estudio SET activa=0 WHERE usuario_id=? AND activa=1`, [req.userId], () => {
    db.run(`INSERT INTO sesiones_estudio(usuario_id,inicio,activa) VALUES(?,datetime('now'),1)`, [req.userId], function(e) {
      if (e) return res.status(500).json({ error: e.message });
      res.json({ success: true, sessionId: this.lastID });
    });
  });
});

app.post('/api/estudio/finalizar', auth, (req, res) => {
  db.get(`SELECT id FROM sesiones_estudio WHERE usuario_id=? AND activa=1 ORDER BY id DESC LIMIT 1`, [req.userId], (e, s) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!s) return res.json({ success: true, segundos: 0 });
    db.run(`UPDATE sesiones_estudio SET fin=datetime('now'),segundos=CAST((julianday('now')-julianday(inicio))*86400 AS INTEGER),activa=0 WHERE id=?`, [s.id], e2 => {
      if (e2) return res.status(500).json({ error: e2.message });
      res.json({ success: true });
    });
  });
});

app.post('/api/clases/entrar', auth, (req, res) => {
  const codigo = String(req.body.codigo || '').trim().toUpperCase();
  if (!codigo) return res.status(400).json({ error: 'Ingresa el código de clase' });
  db.get(`SELECT id,codigo,nombre,materia_id FROM clases WHERE codigo=? AND activa=1`, [codigo], (e, c) => {
    if (e) return res.status(500).json({ error: e.message });
    if (!c) return res.status(404).json({ error: 'Código de clase no válido' });
    db.run(`INSERT OR IGNORE INTO asistencia(clase_id,usuario_id) VALUES(?,?)`, [c.id, req.userId], e2 => {
      if (e2) return res.status(500).json({ error: e2.message });
      res.json({ success: true, clase: c });
    });
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`InnovaBoard funcionando en puerto ${PORT}`));
