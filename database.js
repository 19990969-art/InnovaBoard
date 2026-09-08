const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(path.join(dataDir, 'innovaboard.db'));

function hashPassword(password) {
  return crypto.scryptSync(password, 'innovaboard-demo-salt', 64).toString('hex');
}

function seed() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      correo TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nivel INTEGER DEFAULT 1,
      creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS materias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS temas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      total_lecciones INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (materia_id) REFERENCES materias(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS lecciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tema_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      contenido TEXT NOT NULL,
      FOREIGN KEY (tema_id) REFERENCES temas(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS actividades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      tipo TEXT,
      FOREIGN KEY (materia_id) REFERENCES materias(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS actividades_realizadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      actividad_id INTEGER NOT NULL,
      realizada_en TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(usuario_id, actividad_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (actividad_id) REFERENCES actividades(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS lecciones_completadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      leccion_id INTEGER NOT NULL,
      completada_en TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(usuario_id, leccion_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (leccion_id) REFERENCES lecciones(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sesiones_estudio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      inicio TEXT NOT NULL,
      fin TEXT,
      segundos INTEGER DEFAULT 0,
      activa INTEGER DEFAULT 1,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      materia_id INTEGER NOT NULL,
      activa INTEGER DEFAULT 1,
      creada_en TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (materia_id) REFERENCES materias(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clase_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      entrada TEXT DEFAULT CURRENT_TIMESTAMP,
      salida TEXT,
      UNIQUE(clase_id, usuario_id),
      FOREIGN KEY (clase_id) REFERENCES clases(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`INSERT OR IGNORE INTO usuarios (id,nombre,correo,password_hash,nivel)
      VALUES (1,'Estudiante','estudiante@innovaboard.local',?,5)`, [hashPassword('123456')]);

    db.run(`INSERT OR IGNORE INTO materias (id,nombre) VALUES (1,'Lenguaje')`);

    const temas = [
      [1,1,'Comprensión lectora','Identifica ideas principales, interpreta textos y desarrolla pensamiento crítico.',8],
      [2,1,'Redacción y escritura','Organiza ideas y escribe textos claros y coherentes.',6],
      [3,1,'Gramática y ortografía','Practica reglas gramaticales, ortográficas y signos de puntuación.',10],
      [4,1,'Comunicación oral','Desarrolla habilidades para expresar ideas y argumentos.',5],
      [5,1,'Literatura','Conoce géneros, obras y recursos literarios.',7],
      [6,1,'Vocabulario','Amplía tu vocabulario y mejora la precisión de tus expresiones.',6]
    ];
    const st = db.prepare(`INSERT OR IGNORE INTO temas(id,materia_id,nombre,descripcion,total_lecciones) VALUES(?,?,?,?,?)`);
    temas.forEach(r=>st.run(r)); st.finalize();

    const lecciones = [
      [1,1,'Ideas principales','Aprende a identificar la idea principal de un texto.' ],
      [2,1,'Ideas secundarias','Reconoce la información que complementa la idea principal.' ],
      [3,1,'Inferencias','Deduce información que no aparece de forma explícita.' ],
      [4,1,'Propósito del autor','Identifica la intención comunicativa de un texto.' ],
      [5,2,'Planificación del texto','Organiza las ideas antes de escribir.' ],
      [6,2,'Párrafos coherentes','Construye párrafos con unidad y coherencia.' ],
      [7,3,'Acentuación','Aplica reglas básicas de acentuación.' ],
      [8,3,'Signos de puntuación','Utiliza correctamente los principales signos de puntuación.' ],
      [9,4,'Comunicación efectiva','Organiza un mensaje claro para una audiencia.' ],
      [10,5,'Géneros literarios','Distingue narrativa, lírica y drama.' ],
      [11,6,'Sinónimos y antónimos','Amplía el vocabulario mediante relaciones de significado.' ]
    ];
    const sl = db.prepare(`INSERT OR IGNORE INTO lecciones(id,tema_id,titulo,contenido) VALUES(?,?,?,?)`);
    lecciones.forEach(r=>sl.run(r)); sl.finalize();

    const actividades = [
      [1,1,'Comprensión de lectura','Lee un texto y responde preguntas sobre sus ideas principales.','lectura'],
      [2,1,'Corrige la oración','Identifica errores de ortografía y gramática.','ortografia'],
      [3,1,'Expresa tu opinión','Escribe una respuesta argumentada sobre un tema.','argumentacion'],
      [4,1,'Análisis literario','Identifica tema, personajes y recursos literarios.','literatura'],
      [5,1,'Vocabulario','Relaciona palabras con su significado.','vocabulario']
    ];
    const sa = db.prepare(`INSERT OR IGNORE INTO actividades(id,materia_id,titulo,descripcion,tipo) VALUES(?,?,?,?,?)`);
    actividades.forEach(r=>sa.run(r)); sa.finalize();

    db.run(`INSERT OR IGNORE INTO clases(id,codigo,nombre,materia_id,activa) VALUES(1,'LEN-2026','Clase de Lenguaje - Comprensión lectora',1,1)`);

    db.run(`INSERT OR IGNORE INTO lecciones_completadas(usuario_id,leccion_id) VALUES(1,1)`);
    db.run(`INSERT OR IGNORE INTO lecciones_completadas(usuario_id,leccion_id) VALUES(1,2)`);
    db.run(`INSERT OR IGNORE INTO actividades_realizadas(usuario_id,actividad_id) VALUES(1,1)`);
  });
}

seed();
module.exports = { db, hashPassword };