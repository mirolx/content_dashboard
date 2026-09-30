'use client'

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { EditableText } from '@/components/EditableText'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fieldClass, selectClass } from '@/components/ui/field'
import { Tag } from '@/components/ui/tag'
import { newId } from '@/lib/id'
import { useLiveList } from '@/lib/realtime/useLiveList'
import { useWorkspaceId } from '@/lib/realtime/WorkspaceRealtime'
import { REFERENCE_KINDS, type ReferenceItem, type ReferenceKind } from '@/lib/types'
import { optionalUrlSchema, textSchema } from '@/lib/validation'
import { referencesData } from './data'

const byNewest = (a: ReferenceItem, b: ReferenceItem) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

export function ReferencesWidget({ initial }: { initial: ReferenceItem[] }) {
  const t = useTranslations('references')
  const tc = useTranslations('common')
  const workspaceId = useWorkspaceId()
  const { rows, mutate, error } = useLiveList('reference_items', initial, byNewest)
  const [kind, setKind] = useState<ReferenceKind>('thumbnail')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [note, setNote] = useState('')
  const [invalidUrl, setInvalidUrl] = useState(false)

  function add(e: FormEvent) {
    e.preventDefault()
    const parsedTitle = textSchema.safeParse(title)
    if (!parsedTitle.success) return
    const parsedUrl = optionalUrlSchema.safeParse(url)
    const parsedImage = optionalUrlSchema.safeParse(imageUrl)
    if (!parsedUrl.success || !parsedImage.success) {
      setInvalidUrl(true)
      return
    }
    setInvalidUrl(false)
    const row: ReferenceItem = {
      id: newId(),
      workspace_id: workspaceId,
      kind,
      title: parsedTitle.data,
      url: parsedUrl.data,
      image_url: parsedImage.data,
      note: note.trim(),
      created_at: new Date().toISOString(),
    }
    setTitle('')
    setUrl('')
    setImageUrl('')
    setNote('')
    void mutate({ type: 'INSERT', row }, () => referencesData.insert(row))
  }

  function update(row: ReferenceItem, patch: Partial<ReferenceItem>) {
    return mutate({ type: 'UPDATE', row: { ...row, ...patch } }, () =>
      referencesData.update(row.id, patch),
    )
  }

  const inputClass = `${fieldClass} min-w-0`

  return (
    <Card
      tone="dark"
      title={t('title')}
      error={invalidUrl ? t('invalidUrl') : error ? tc('saveFailed') : null}
    >
      <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          aria-label={t('kindLabel')}
          value={kind}
          onChange={(e) => setKind(e.target.value as ReferenceKind)}
          className={`${selectClass} min-w-0`}
        >
          {REFERENCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </select>
        <input aria-label={t('titleLabel')} placeholder={t('titleLabel')} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        <input aria-label={t('urlLabel')} placeholder={t('urlLabel')} value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} />
        <input aria-label={t('imageUrlLabel')} placeholder={t('imageUrlLabel')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} />
        <input aria-label={t('noteLabel')} placeholder={t('noteLabel')} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} sm:col-span-2`} />
        <Button type="submit" size="sm" className="sm:col-span-2">
          {tc('add')}
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm opacity-60">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 rounded-2xl border border-current/15 p-3">
              {row.image_url && (
                // 외부 임의 도메인 이미지라 next/image 대신 img를 쓴다.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.image_url} alt="" className="h-28 w-full rounded-xl object-cover" />
              )}
              <span className="w-fit">
                <Tag>{t(`kinds.${row.kind}`)}</Tag>
              </span>
              <EditableText
                label={t('titleLabel')}
                value={row.title}
                onSave={(v) => update(row, { title: v })}
                className="text-sm font-medium"
              />
              {row.note && <p className="text-xs opacity-60">{row.note}</p>}
              <div className="mt-auto flex items-center gap-2 text-sm">
                {row.url && (
                  <a href={row.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {t('open')}
                  </a>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  magnetic={false}
                  onClick={() =>
                    void mutate({ type: 'DELETE', id: row.id }, () => referencesData.remove(row.id))
                  }
                  className="ml-auto"
                >
                  {tc('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
