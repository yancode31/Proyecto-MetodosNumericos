#!/usr/bin/env python3
"""Servidor académico local: frontend estático + API JSON + SQLite.
Ejecutar: python server.py --port 8000
Solo escucha 127.0.0.1 (no servidor público / no autenticación remota).
"""
import argparse
import json
import mimetypes
import re
import sqlite3
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
DB_FILE = ROOT / 'database' / 'simtele.db'
TABLES = {'caso_estudio', 'escenario', 'simulacion', 'ejecucion_metodo',
          'iteracion_resultado', 'resultado_resumen'}


def connect():
    cx = sqlite3.connect(DB_FILE, timeout=10)
    cx.row_factory = sqlite3.Row
    cx.execute('PRAGMA foreign_keys = ON')
    cx.execute('PRAGMA busy_timeout=5000')
    return cx


def init_db():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with connect() as cx:
        cx.executescript((ROOT / 'database' / 'schema.sql').read_text('utf-8'))


def load_all():
    with connect() as cx:
        rows = cx.execute('SELECT snapshot_json FROM simulacion ORDER BY fecha DESC').fetchall()
    return [json.loads(row['snapshot_json']) for row in rows]


def num(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    try:
        return float(str(value).strip().replace('%', '').replace('−','-'))
    except (ValueError, TypeError):
        return None


def save_one(record):
    if not isinstance(record, dict) or not isinstance(record.get('result'), dict):
        raise ValueError('Registro incompleto.')
    result = record['result']
    ident = record.get('id')
    if not isinstance(ident, str) or not 1 <= len(ident) <= 120 or not re.fullmatch(r'[a-zA-Z0-9_.:-]+', ident):
        raise ValueError('ID de simulación no válido.')
    case_id = result.get('caseId')
    scenario = result.get('scenario')
    if type(case_id) is not int or case_id not in (1,2,3,4):
        raise ValueError('Caso inválido.')
    if scenario not in ('NORMAL', 'ESTRÉS', 'MAL CONDICIONADO'):
        raise ValueError('Escenario inválido.')
    params = result.get('params')
    if not isinstance(params, dict) or len(params)>30:
        raise ValueError('Parámetros inválidos.')
    tables = result.get('tables')
    if not isinstance(tables, list) or len(tables)>32:
        raise ValueError('Tablas de métodos inválidas.')
    created_at = record.get('createdAt')
    if not isinstance(created_at, str) or len(created_at)>64:
        raise ValueError('Fecha inválida.')
    snapshot = json.dumps(record, ensure_ascii=False, allow_nan=False)
    if len(snapshot.encode('utf-8')) > 4_000_000:
        raise ValueError('Experimento demasiado grande.')
    with connect() as cx:
        already = cx.execute('SELECT 1 FROM simulacion WHERE id=?', (ident,)).fetchone()
        if already:
            return {'id': ident, 'alreadyExists': True}
        cur = cx.execute('INSERT INTO escenario(caso_id,tipo,parametros_json) VALUES (?,?,?)',
                         (case_id, scenario, json.dumps(params, ensure_ascii=False, allow_nan=False)))
        esc_id = cur.lastrowid
        cx.execute('INSERT INTO simulacion(id,escenario_id,fecha,estado,modelo_version,snapshot_json) VALUES (?,?,?,?,?,?)',
                   (ident,esc_id,created_at,'COMPLETADA',record.get('modelVersion','semana2-v2'),snapshot))
        for tbl in tables:
            headers = tbl.get('headers', [])
            data_rows = tbl.get('rows', [])
            if not isinstance(headers,list) or not isinstance(data_rows,list) or len(data_rows)>10000:
                continue
            method = str(tbl.get('title', 'Tabla sin título'))[:200]
            cur = cx.execute('INSERT INTO ejecucion_metodo(simulacion_id,metodo,tolerancia,paso,max_iter,convergio,headers_json) VALUES(?,?,?,?,?,?,?)',
                             (ident, method, 1e-10, num(params.get('h')), len(data_rows), 1,
                              json.dumps(headers, ensure_ascii=False)))
            eid = cur.lastrowid
            lower = [str(x).lower() for x in headers]
            def find_col(*words):
                for idx,label in enumerate(lower):
                    if any(word in label for word in words): return idx
                return -1
            res_idx = find_col('residual','residuo')
            err_idx = find_col('error abs','error rk4','‖x−x*‖')
            rel_idx = find_col('error rel','error %')
            for k,row in enumerate(data_rows):
                if not isinstance(row,list): continue
                def val(idx): return num(row[idx]) if idx>=0 and idx<len(row) else None
                cx.execute('INSERT INTO iteracion_resultado(ejecucion_id,numero,aproximacion_json,residual,error_abs,error_rel) VALUES (?,?,?,?,?,?)',
                           (eid,k,json.dumps(row,ensure_ascii=False,allow_nan=False),val(res_idx),val(err_idx),val(rel_idx)))
            cx.execute('INSERT INTO resultado_resumen(ejecucion_id,referencia,valor_json,metrica_error_json,interpretacion) VALUES (?,?,?,?,?)',
                       (eid,'Referencia analítica o refinada declarada por módulo',
                        json.dumps(result.get('metric',{}),ensure_ascii=False,allow_nan=False),
                        json.dumps(result.get('summary',[]),ensure_ascii=False,allow_nan=False),
                        str(result.get('numeric',''))[:2000]))
    return {'id':ident,'alreadyExists':False}


def remove_one(ident):
    with connect() as cx:
        row = cx.execute('SELECT escenario_id FROM simulacion WHERE id=?',(ident,)).fetchone()
        if not row:return False
        cx.execute('DELETE FROM simulacion WHERE id=?',(ident,))
        cx.execute('DELETE FROM escenario WHERE id=? AND NOT EXISTS (SELECT 1 FROM simulacion WHERE escenario_id=?)',(row['escenario_id'],row['escenario_id']))
    return True


def preview_table(table):
    if table not in TABLES:raise ValueError('Tabla no permitida.')
    with connect() as cx:
        columns = [row[1] for row in cx.execute(f'PRAGMA table_info("{table}")')]
        rows = [dict(row) for row in cx.execute(f'SELECT * FROM "{table}" ORDER BY rowid DESC LIMIT 40')]
        total = cx.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    for row in rows:
        for key, value in row.items():
            if isinstance(value,str) and len(value)>500:row[key]=value[:480]+' …'
    return {'table':table,'columns':columns,'rows':rows,'total':total}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def reply(self,code,data):
        body = json.dumps(data,ensure_ascii=False,allow_nan=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers();self.wfile.write(body)
    def do_GET(self):
        path=urlparse(self.path).path
        if path=='/api/health':
            return self.reply(200,{'status':'ok','database':'SQLite','file':'database/simtele.db'})
        if path=='/api/experimentos':
            return self.reply(200,load_all())
        if path.startswith('/api/tabla/'):
            try:return self.reply(200,preview_table(unquote(path.removeprefix('/api/tabla/'))))
            except ValueError as exc:return self.reply(400,{'error':str(exc)})
        if path.startswith('/api/'):
            return self.reply(404,{'error':'Ruta API inexistente.'})
        # SQLite no se debe exponer públicamente como archivo estático.
        if path.startswith('/database/') and (path.endswith('.db') or path.endswith('.db-wal') or path.endswith('.db-shm')):
            return self.reply(403,{'error':'Base de datos no descargable por HTTP.'})
        return super().do_GET()
    def do_POST(self):
        if urlparse(self.path).path!='/api/experimentos':
            return self.reply(404,{'error':'Ruta API inexistente.'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=4_000_000:return self.reply(413,{'error':'Tamaño no permitido.'})
            obj=json.loads(self.rfile.read(length))
            return self.reply(201,save_one(obj))
        except (ValueError,sqlite3.Error) as exc:
            return self.reply(400,{'error':str(exc)})
    def do_DELETE(self):
        path=urlparse(self.path).path
        if not path.startswith('/api/experimentos/'):
            return self.reply(404,{'error':'Ruta API inexistente.'})
        ident=unquote(path.split('/')[-1])
        return self.reply(200,{'deleted':remove_one(ident)})


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='SIMTELE-RISK Semana 2 · SQLite local')
    parser.add_argument('--port',type=int,default=8000)
    args=parser.parse_args()
    init_db()
    print(f'\nSIMTELE-RISK | servidor SQLite en http://127.0.0.1:{args.port}/')
    print(f'Base persistente: {DB_FILE}\nCtrl+C para salir.\n')
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
