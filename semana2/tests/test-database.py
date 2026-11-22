import importlib.util
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

module_file=Path(__file__).resolve().parents[1]/'server.py'
spec=importlib.util.spec_from_file_location('simtele_server',module_file)
sv=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sv)

with tempfile.TemporaryDirectory() as d:
    sv.DB_FILE=Path(d)/'prueba.db'
    sv.init_db()
    record={
      'id':'prueba-1','createdAt':datetime.now(timezone.utc).isoformat(),
      'modelVersion':'semana2-v2','result':{
        'caseId':1,'scenario':'NORMAL','params':{'v0':10,'a':2,'tr':1.5,'h':0.5},
        'metric':{'label':'Distancia total','value':40,'unit':'m'},
        'summary':[{'label':'Tiempo','value':5,'unit':'s'}],
        'numeric':'Exactitud por referencia analítica.',
        'physical':'Modelo físico hipotético.',
        'tables':[{'title':'Raíces','headers':['Método','Iteraciones','Residual'],
                   'rows':[['Bisección',3,1e-4],['Newton-Raphson',2,1e-8]]}],
        'plots':[{'title':'Curva','series':[{'name':'Referencia','points':[[0,10],[5,0]]}]}]
      }
    }
    sv.save_one(record)
    assert len(sv.load_all())==1
    assert sv.load_all()[0]['result']['metric']['value']==40
    assert sv.preview_table('caso_estudio')['total']==4
    assert sv.preview_table('escenario')['total']==1
    assert sv.preview_table('simulacion')['total']==1
    assert sv.preview_table('ejecucion_metodo')['total']==1
    assert sv.preview_table('iteracion_resultado')['total']==2
    assert sv.preview_table('resultado_resumen')['total']==1
    assert sv.save_one(record)['alreadyExists'] is True
    try: sv.preview_table('sqlite_master; DROP TABLE simulacion')
    except ValueError: pass
    else: raise AssertionError('Se permitió SQL injection en explorador')
    assert sv.remove_one('prueba-1') is True
    assert sv.preview_table('simulacion')['total']==0
    assert sv.preview_table('escenario')['total']==0
    assert sv.preview_table('iteracion_resultado')['total']==0
    print('OK · 13 verificaciones de SQLite: guardar, consultar 6 tablas, deduplicar y eliminar.')
