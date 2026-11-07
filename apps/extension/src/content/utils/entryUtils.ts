/**
 * 엔트리 엔진 연동 공통 헬퍼 유틸리티
 */

export function generateEntryHash(): string {
  if (typeof window !== 'undefined' && (window as any).Entry?.generateHash) {
    try {
      return (window as any).Entry.generateHash();
    } catch {}
  }
  return Math.random().toString(36).slice(2, 6);
}

export function getEntityName(entity: any): string {
  if (!entity) return '';
  return entity.name || entity.name_ || (typeof entity.getName === 'function' ? entity.getName() : '');
}

export function getEntityId(entity: any): string {
  if (!entity) return '';
  return entity.id || entity.id_ || (typeof entity.getId === 'function' ? entity.getId() : '');
}

export function getOwnerObjectId(entity: any): string | null {
  if (!entity) return null;
  return (
    entity.object_ ??
    entity.object ??
    entity.objectId ??
    entity.scope?.objectId ??
    entity.referenceVariable?.objectId ??
    null
  );
}

