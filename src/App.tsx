import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, Check, ChevronDown, CircleHelp, Code2, Download, FileJson, FolderOpen, Grid2X2, Redo2, Save, Sparkles, Undo2, WandSparkles, X } from 'lucide-react';
import { useStudio } from './store/useStudio';
import { LibraryPanel } from './components/LibraryPanel';
import { CanvasEditor } from './components/CanvasEditor';
import { InspectorPanel } from './components/InspectorPanel';
import { GenerationModal } from './components/GenerationModal';
import { VariantsPanel } from './components/VariantsPanel';
import { ProjectsModal } from './components/ProjectsModal';
import { downloadFile, exportProject, exportSvg, importProject } from './services/SvgExportService';
import { api } from './services/api';

export default function App() {
  const state = useStudio(); const [modal, setModal] = useState<'generate'|'projects'|'help'|null>(null);
  const [server, setServer] = useState(false); const [exportOpen, setExportOpen] = useState(false); const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { api.health().then(() => setServer(true)).catch(() => setServer(false)); }, []);
  useEffect(() => {
    const failed = () => useStudio.getState().notify('Автосохранение недоступно. Скачайте резервную копию проекта в JSON.');
    window.addEventListener('forma:storage-error', failed);
    return () => window.removeEventListener('forma:storage-error', failed);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setModal(null); setExportOpen(false); }
      if (e.key === 'Tab') {
        const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]'); const dialog = dialogs[dialogs.length-1];
        if (dialog) {
          const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]')];
          const first = items[0], last = items[items.length-1];
          if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first?.focus(); }
        }
      }
      const target = e.target as HTMLElement;
      if (['INPUT','TEXTAREA','SELECT'].includes(target.tagName) || target.isContentEditable || document.querySelector('[role="dialog"]')) return;
      const studio = useStudio.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) studio.redo(); else studio.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); studio.duplicate(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); studio.remove(); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => { if (!state.notice) return; const timeout = setTimeout(() => useStudio.getState().notify(null), 7000); return () => clearTimeout(timeout); }, [state.notice]);
  function downloadJson() { downloadFile(exportProject(state.title,state.composition,state.assets), 'forma-project.json', 'application/json'); setExportOpen(false); }
  function downloadSvg() { try { downloadFile(exportSvg(state.composition,state.assets),'forma-composition.svg','image/svg+xml'); } catch (e) { state.notify((e as Error).message); } setExportOpen(false); }
  async function save() {
    setSaving(true);
    try { await api.saveProject({ version: 1, title: state.title || 'Без названия', assets: state.assets, composition: state.composition }); setServer(true); state.notify('Проект сохранён на сервере. Его можно открыть в списке проектов.'); }
    catch { setServer(false); downloadJson(); state.notify('Сервер недоступен. Резервная копия проекта сохранена в JSON.'); }
    finally { setSaving(false); }
  }
  return <div className="studio-app">
    <header className="topbar"><button className="brand" aria-label="Открыть проекты" onClick={() => setModal('projects')}><span className="brand-symbol"><i/><i/><i/><i/></span><strong>форма<span>®</span></strong></button><div className="header-divider"/><div className="project-title"><input aria-label="Название проекта" value={state.title} maxLength={100} onChange={e => state.setTitle(e.target.value)}/><span className="project-kind">SVG-композиция</span></div><div className="header-actions"><span className="autosave"><Check size={12}/>Автосохранение</span><button className="button save-button" onClick={() => void save()} disabled={saving}><Save size={15}/>{saving ? 'Сохраняем…' : 'Сохранить'}</button><div className="export-wrapper"><button className="button primary export-button" onClick={() => setExportOpen(!exportOpen)} aria-expanded={exportOpen}><ArrowDownToLine size={16}/>Экспорт<ChevronDown size={13}/></button>{exportOpen && <><div className="dropdown-scrim" onClick={() => setExportOpen(false)}/><div className="export-dropdown"><button onClick={downloadSvg}><Code2 size={16}/><span>Векторный SVG<small>Готов к Figma и Illustrator</small></span><Download size={13}/></button><button onClick={downloadJson}><FileJson size={16}/><span>Проект JSON<small>Библиотека и композиция</small></span><Download size={13}/></button></div></>}</div><button className="avatar" title="Справка по студии" onClick={() => setModal('help')}>Ф</button></div></header>
    <div className="workspace-toolbar"><div className="workspace-navigation"><button className="icon-button" title="Сохранённые проекты" aria-label="Сохранённые проекты" onClick={() => setModal('projects')}><ArrowLeft size={16}/></button><span className="toolbar-divider"/><button className="toolbar-tab active"><Grid2X2 size={15}/>Редактор</button></div><div className="history-tools"><button className="icon-button" aria-label="Отменить" title="Отменить · Ctrl+Z" disabled={!state.past.length} onClick={state.undo}><Undo2 size={16}/></button><button className="icon-button" aria-label="Повторить" title="Повторить · Ctrl+Shift+Z" disabled={!state.future.length} onClick={state.redo}><Redo2 size={16}/></button><span className="toolbar-divider"/><button className="text-button" onClick={() => fileInput.current?.click()}><FolderOpen size={14}/>Открыть JSON</button><button className="text-button reset-button" onClick={state.reset}>Очистить холст</button></div><button className="button generate-button" onClick={() => setModal('generate')}><WandSparkles size={16}/>Создать композицию<span>↗</span></button></div>
    <main className="workspace-layout"><LibraryPanel/><div className="center-column"><div className="intro-strip"><div className="intro-icon"><Sparkles size={18}/></div><div><strong>Больше идей. Меньше рутины.</strong><p>Выберите элементы — мы найдём для них новую композицию.</p></div><button className="text-button" onClick={() => setModal('generate')}>Попробовать <span>→</span></button></div><CanvasEditor/><VariantsPanel openGenerator={() => setModal('generate')}/></div><InspectorPanel/></main>
    <footer className="app-footer"><span>ФОРМА <i/>СТУДИЯ ВЕКТОРНЫХ КОМПОЗИЦИЙ</span><span className="demo-disclosure">{state.assets.some(a => a.demo) ? 'Демо-фигуры · оригинальные SVG загрузите из Figma' : 'Ваша библиотека SVG'}<i/>{server ? 'Python API подключён' : 'Локальный режим'}</span><button onClick={() => setModal('help')}><CircleHelp size={13}/>Помощь и сочетания клавиш</button></footer>
    <input type="file" ref={fileInput} accept=".json,application/json" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { state.loadProject(importProject(await file.text())); state.notify('Проект открыт.'); } catch (err) { state.notify(`Не удалось открыть проект: ${(err as Error).message}`); } e.target.value = ''; }}/>
    {modal === 'generate' && <GenerationModal close={() => setModal(null)}/>}{modal === 'projects' && <ProjectsModal close={() => setModal(null)}/>}
    {modal === 'help' && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">КАК ЭТО РАБОТАЕТ</span><h2 id="help-title">Маленькая студия. Большие идеи.</h2></div><button className="icon-button" aria-label="Закрыть справку" onClick={() => setModal(null)}><X size={20}/></button></div><ol className="help-steps"><li>Загрузите SVG из Figma через «Импорт SVG». Демо-фигуры нужны для проверки функций и не заменяют оригиналы.</li><li>Выберите объекты или введите тему в «Создать композицию». Для поиска по теме назначьте объектам теги.</li><li>Настройте палитру и формат. Перемещайте объекты, тяните углы рамки для масштаба, круг над рамкой — для поворота.</li><li>Скачайте SVG или сохраните весь проект в JSON. Оригинальные цвета сохраняются, пока вы не назначите карту цветов в библиотеке.</li></ol><div className="keyboard-shortcuts"><span>Отменить <kbd>Ctrl Z</kbd></span><span>Повторить <kbd>Ctrl Shift Z</kbd></span><span>Дублировать <kbd>Ctrl D</kbd></span><span>Удалить <kbd>Delete</kbd></span></div><p className="muted">Для объединения исходных вариантов: книга__main__S.svg, книга__main__L.svg, книга__background__S.svg. Все данные автоматически сохраняются в браузере. Кнопка «Сохранить» записывает проект в Python API.</p></section></div>}
    {state.notice && <div className="toast" role="status"><span>{state.notice}</span><button aria-label="Закрыть уведомление" onClick={() => state.notify(null)}><X size={16}/></button></div>}
  </div>;
}
