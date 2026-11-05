import type { Asset, ProjectFile } from '../types';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : `Ошибка сервера: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
export const api = {
  health: () => request<{ status: string }>('/health'),
  assets: () => request<Asset[]>('/assets'),
  saveAssets: (assets: Asset[]) => request('/assets', { method: 'POST', body: JSON.stringify({ assets }) }),
  saveProject: (project: ProjectFile) => request<{ id: string }>('/projects', { method: 'POST', body: JSON.stringify(project) }),
  projects: () => request<{ id: string; title: string; updated: string }[]>('/projects'),
  project: (id: string) => request<ProjectFile>(`/projects/${encodeURIComponent(id)}`),
};
