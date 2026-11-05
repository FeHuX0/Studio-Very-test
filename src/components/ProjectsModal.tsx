import { useEffect, useState } from 'react';
import { ArrowUpRight, FolderOpen, X } from 'lucide-react';
import { api } from '../services/api';
import { importProject } from '../services/SvgExportService';
import { useStudio } from '../store/useStudio';
export function ProjectsModal({ close }: { close: () => void }) {
  const [projects, setProjects] = useState<{ id: string; title: string; updated: string }[]>([]);
  const [status, setStatus] = useState('Загружаем проекты…');
  useEffect(() => { let active = true; api.projects().then(items => { if (active) { setProjects(items); setStatus(items.length ? '' : 'Пока нет сохранённых проектов. Нажмите «Сохранить» в редакторе.'); } }).catch(() => { if (active) setStatus('Сервер недоступен. Запустите Python-бэкенд или откройте проект из JSON.'); }); return () => { active = false; }; }, []);
  async function open(id: string) { try { const value = await api.project(id); useStudio.getState().loadProject(importProject(JSON.stringify(value))); close(); } catch (e) { setStatus((e as Error).message); } }
  return <div className="modal-backdrop" onClick={close}><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="projects-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">ВАША СТУДИЯ</span><h2 id="projects-title">Сохранённые проекты</h2></div><button className="icon-button" aria-label="Закрыть проекты" onClick={close}><X size={20}/></button></div><p className="muted">{status}</p><div className="projects-list">{projects.map(p => <button key={p.id} onClick={() => void open(p.id)}><FolderOpen size={19}/><span><strong>{p.title}</strong><small>{new Date(p.updated).toLocaleString('ru-RU')}</small></span><ArrowUpRight size={16}/></button>)}</div></section></div>;
}
