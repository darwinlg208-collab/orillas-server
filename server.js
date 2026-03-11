
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT      = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const DIR       = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css',
  '.js'  : 'application/javascript',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      cursos: [
        { id: 1, nombre: 'Curso de Windsurf',    instructor: 'Pilar Prieto Calvo', horario: 'Sábados 10:00–13:00',       cupos: 10, inscritos: 0, precio_nosocio: 90, precio_socio: 80 },
        { id: 2, nombre: 'Curso de Vela Ligera', instructor: 'Fernando Polo',       horario: 'Domingos 10:00–13:00',      cupos: 8,  inscritos: 0, precio_nosocio: 90, precio_socio: 80 },
        { id: 3, nombre: 'Curso de Wing Foil',   instructor: 'Gonzalo Ruiz',        horario: 'Sábados 16:00–19:00',       cupos: 6,  inscritos: 0, precio_nosocio: 90, precio_socio: 80 },
        { id: 4, nombre: 'Alquiler Kayak',       instructor: '',                    horario: 'Todos los días 10:00–20:00', cupos: 20, inscritos: 0, precio_nosocio: 15, precio_socio: 10 },
        { id: 5, nombre: 'Alquiler Paddle Surf', instructor: '',                    horario: 'Todos los días 10:00–20:00', cupos: 15, inscritos: 0, precio_nosocio: 15, precio_socio: 10 }
      ],
      reservas: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function jsonRes(res, data, status) {
  const body = JSON.stringify(data);
  res.writeHead(status || 200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch(e) { reject(e); }
    });
  });
}

function serveFile(res, filePath) {
  var ext  = path.extname(filePath).toLowerCase();
  var mime = MIME[ext] || 'text/plain';
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
}

var server = http.createServer(function(req, res) {
  var parsed   = url.parse(req.url, true);
  var pathname = parsed.pathname;
  var method   = req.method.toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(); return;
  }

  // POST /api/login
  if (pathname === '/api/login' && method === 'POST') {
    readBody(req).then(function(body) {
      if (body.password === '2008') {
        jsonRes(res, { ok: true, token: 'admin-orillas-2026' });
      } else {
        jsonRes(res, { error: 'Contraseña incorrecta' }, 401);
      }
    });
    return;
  }

  // GET /api/cursos
  if (pathname === '/api/cursos' && method === 'GET') {
    jsonRes(res, loadData().cursos); return;
  }

  // POST /api/cursos
  if (pathname === '/api/cursos' && method === 'POST') {
    readBody(req).then(function(body) {
      var data  = loadData();
      var nuevo = Object.assign({ id: Date.now(), inscritos: 0 }, body);
      data.cursos.push(nuevo);
      saveData(data);
      jsonRes(res, nuevo);
    });
    return;
  }

  // PUT /api/cursos/:id
  var mCursoEdit = pathname.match(/^\/api\/cursos\/(\d+)$/);
  if (mCursoEdit && method === 'PUT') {
    readBody(req).then(function(body) {
      var data = loadData();
      var idx  = data.cursos.findIndex(function(c) { return c.id == mCursoEdit[1]; });
      if (idx === -1) { jsonRes(res, { error: 'No encontrado' }, 404); return; }
      data.cursos[idx] = Object.assign({}, data.cursos[idx], body);
      saveData(data);
      jsonRes(res, data.cursos[idx]);
    });
    return;
  }

  // DELETE /api/cursos/:id
  if (mCursoEdit && method === 'DELETE') {
    var data = loadData();
    data.cursos = data.cursos.filter(function(c) { return c.id != mCursoEdit[1]; });
    saveData(data);
    jsonRes(res, { ok: true }); return;
  }

  // GET /api/reservas
  if (pathname === '/api/reservas' && method === 'GET') {
    jsonRes(res, loadData().reservas); return;
  }

  // POST /api/reservas
  if (pathname === '/api/reservas' && method === 'POST') {
    readBody(req).then(function(body) {
      var nombre = body.nombre, email = body.email, telefono = body.telefono;
      var actividad = body.actividad, mensaje = body.mensaje;
      if (!nombre || !email || !actividad) {
        jsonRes(res, { error: 'Faltan campos obligatorios' }, 400); return;
      }
      var data = loadData();
      var cursoMatch = data.cursos.find(function(c) {
        return actividad.toLowerCase().indexOf(c.nombre.toLowerCase().split(' ').pop()) !== -1;
      });
      var reserva = {
        id: Date.now(),
        nombre: nombre, email: email, telefono: telefono || '',
        actividad: actividad, mensaje: mensaje || '',
        curso_id: cursoMatch ? cursoMatch.id : null,
        estado: 'pendiente',
        fecha: new Date().toISOString()
      };
      if (cursoMatch) {
        var idx = data.cursos.findIndex(function(c) { return c.id === cursoMatch.id; });
        if (data.cursos[idx].inscritos < data.cursos[idx].cupos) data.cursos[idx].inscritos++;
      }
      data.reservas.push(reserva);
      saveData(data);
      jsonRes(res, { ok: true, reserva: reserva });
    });
    return;
  }

  // PUT /api/reservas/:id/estado
  var mResEstado = pathname.match(/^\/api\/reservas\/(\d+)\/estado$/);
  if (mResEstado && method === 'PUT') {
    readBody(req).then(function(body) {
      var data = loadData();
      var idx  = data.reservas.findIndex(function(r) { return r.id == mResEstado[1]; });
      if (idx === -1) { jsonRes(res, { error: 'No encontrada' }, 404); return; }
      data.reservas[idx].estado = body.estado;
      saveData(data);
      jsonRes(res, data.reservas[idx]);
    });
    return;
  }

  // DELETE /api/reservas/:id
  var mResDel = pathname.match(/^\/api\/reservas\/(\d+)$/);
  if (mResDel && method === 'DELETE') {
    var data2 = loadData();
    var reserva2 = data2.reservas.find(function(r) { return r.id == mResDel[1]; });
    if (reserva2 && reserva2.curso_id) {
      var idx2 = data2.cursos.findIndex(function(c) { return c.id === reserva2.curso_id; });
      if (idx2 !== -1 && data2.cursos[idx2].inscritos > 0) data2.cursos[idx2].inscritos--;
    }
    data2.reservas = data2.reservas.filter(function(r) { return r.id != mResDel[1]; });
    saveData(data2);
    jsonRes(res, { ok: true }); return;
  }

  // Archivos estáticos
  if (pathname === '/' || pathname === '/index.html') { serveFile(res, path.join(DIR, 'index.html')); return; }
  if (pathname === '/admin' || pathname === '/admin.html') { serveFile(res, path.join(DIR, 'admin.html')); return; }

  var filePath = path.join(DIR, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) { serveFile(res, filePath); return; }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, function() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Club Orillas de Alocén — Servidor local    ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  🌊 Web pública:  http://localhost:3000/      ║');
  console.log('║  🔐 Panel admin:  http://localhost:3000/admin ║');
  console.log('║     Contraseña:   2008                        ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
