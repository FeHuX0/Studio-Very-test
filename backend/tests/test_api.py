import copy
import json

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app
from backend.svg import parse_svg

def svg(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">{body}</svg>'

def asset():
    return {"id": "book", "name": "Книга", "category": "Учёба", "tags": ["обучение"], "keywords": ["книга"], "role": "main", "sizeVariants": ["L"], "sources": {"main:L": parse_svg(svg('<rect fill="#123" width="200" height="100"/>'))}, "colorMap": {}, "allowedPalettes": ["lavender", "mint", "peach"], "warnings": []}

def project():
    return {"version": 1, "title": "Обучение", "assets": [asset()], "composition": {"id": "project-1", "name": "Композиция", "seed": 10, "strategy": "central", "score": 90, "canvas": {"width": 1080, "height": 1080, "palette": "lavender", "format": "square"}, "elements": [{"id": "element-1", "objectId": "book", "role": "main", "size": "L", "x": .5, "y": .5, "scale": .4, "rotation": 0, "zIndex": 1, "hidden": False}]}}

@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as value:
        yield value

def test_health_without_ai(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['aiEnabled'] is False

def test_library_persists_and_recomputes_metadata(client):
    a = asset()
    a['sources']['main:L']['aspectRatio'] = 999
    assert client.post('/api/assets', json={'assets': [a]}).status_code == 200
    stored = client.get('/api/assets').json()[0]
    assert stored['sources']['main:L']['aspectRatio'] == 2
    assert stored['name'] == 'Книга'

def test_source_variants_merge(client):
    a = asset()
    client.post('/api/assets', json={'assets': [a]})
    a['sources'] = {'background:S': a['sources']['main:L']}
    a['sizeVariants'] = ['S']
    client.post('/api/assets', json={'assets': [a]})
    result = client.get('/api/assets').json()[0]
    assert set(result['sources']) == {'main:L', 'background:S'}

def test_project_save_update_and_restore(client):
    p = project()
    response = client.post('/api/projects', json=p)
    assert response.status_code == 200, response.text
    key = response.json()['id']
    p['title'] = 'Новая тема'
    assert client.post('/api/projects', json=p).status_code == 200
    assert len(client.get('/api/projects').json()) == 1
    restored = client.get(f'/api/projects/{key}').json()
    assert restored['title'] == 'Новая тема'
    assert restored['composition'] == p['composition']
    assert client.get('/api/projects/missing').status_code == 404

@pytest.mark.parametrize('payload', [
    '<script/>', '<foreignObject/>', '<image href="data:image/png;base64,aaaa"/>',
    '<use href="https://example.test/x"/>', '<rect onload="alert(1)"/>',
    '<rect fill="url(https://example.test/a)"/>', '<style>rect{fill:red}</style>',
    '<rect fill="url(#missing)"/>', '<rect id="x"/><path id="x"/>',
    '<animate attributeName="href" to="javascript:alert(1)"/>',
])
def test_malicious_svg_rejected_in_library_and_projects(client, payload):
    p = project()
    p['assets'][0]['sources']['main:L']['svg'] = svg(payload)
    assert client.post('/api/assets', json={'assets': p['assets']}).status_code == 422
    assert client.post('/api/projects', json=p).status_code == 422

def test_doctype_and_external_entities():
    with pytest.raises(ValueError):
        parse_svg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + svg('<text>&x;</text>'))

@pytest.mark.parametrize('mutation', ['missing', 'format', 'scale', 'duplicate', 'role'])
def test_invalid_project_rejected(client, mutation):
    p = project()
    if mutation == 'missing':
        p['composition']['elements'][0]['objectId'] = 'fake'
    if mutation == 'format':
        p['composition']['canvas']['width'] = 0
    if mutation == 'scale':
        p['composition']['elements'][0]['scale'] = -1
    if mutation == 'duplicate':
        p['composition']['elements'].append(copy.deepcopy(p['composition']['elements'][0]))
    if mutation == 'role':
        p['composition']['elements'][0]['role'] = 'background'
    assert client.post('/api/projects', json=p).status_code == 422

def test_cross_origin_writes_and_non_json_blocked(client):
    assert client.post('/api/projects', json=project(), headers={'Origin': 'https://evil.test'}).status_code == 403
    assert client.post('/api/projects', data='project').status_code == 415

def test_persistence_across_restart(tmp_path):
    with TestClient(create_app(tmp_path)) as one:
        one.post('/api/projects', json=project())
    with TestClient(create_app(tmp_path)) as two:
        assert two.get('/api/projects/project-1').json()['title'] == 'Обучение'
