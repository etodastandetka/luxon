'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Banner {
  id: number
  image_url?: string | null
  video_url?: string | null
  link?: string | null
  is_active: boolean
  order: number
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Banner | null>(null)
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadBanners()
  }, [])

  const loadBanners = async () => {
    try {
      const response = await fetch('/api/banners')
      const data = await response.json()
      if (data.success) {
        setBanners(data.data)
      }
    } catch (error) {
      console.error('Error loading banners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    
    const bannerData = {
      image_url: formData.get('image_url') as string || null,
      video_url: formData.get('video_url') as string || null,
      link: formData.get('link') as string || null,
      is_active: formData.get('is_active') === 'on',
      order: parseInt(formData.get('order') as string) || 0
    }

    try {
      if (editing) {
        const response = await fetch(`/api/banners/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bannerData)
        })
        const data = await response.json()
        if (data.success) {
          await loadBanners()
          setEditing(null)
          setShowForm(false)
        } else {
          alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'))
        }
      } else {
        const response = await fetch('/api/banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bannerData)
        })
        const data = await response.json()
        if (data.success) {
          await loadBanners()
          setShowForm(false)
          // Сброс формы
          const form = e.target as HTMLFormElement
          form.reset()
        } else {
          alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'))
        }
      }
    } catch (error) {
      console.error('Error saving banner:', error)
      alert('Ошибка при сохранении баннера')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить этот баннер?')) return

    try {
      const response = await fetch(`/api/banners/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        await loadBanners()
      } else {
        alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'))
      }
    } catch (error) {
      console.error('Error deleting banner:', error)
      alert('Ошибка при удалении баннера')
    }
  }

  const handleEdit = (banner: Banner) => {
    setEditing(banner)
    setShowForm(true)
  }

  const handleNew = () => {
    setEditing(null)
    setShowForm(true)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-white">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Управление баннерами</h1>
        <button
          onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          + Добавить баннер
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">
            {editing ? 'Редактировать баннер' : 'Новый баннер'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 text-white">URL изображения:</label>
              <input
                type="url"
                name="image_url"
                defaultValue={editing?.image_url || ''}
                className="w-full px-3 py-2 bg-gray-700 rounded text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <label className="block mb-2 text-white">URL видео (если есть):</label>
              <input
                type="url"
                name="video_url"
                defaultValue={editing?.video_url || ''}
                className="w-full px-3 py-2 bg-gray-700 rounded text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com/video.mp4"
              />
            </div>
            <div>
              <label className="block mb-2 text-white">Ссылка (опционально):</label>
              <input
                type="text"
                name="link"
                defaultValue={editing?.link || ''}
                className="w-full px-3 py-2 bg-gray-700 rounded text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="https://example.com или /page"
              />
            </div>
            <div>
              <label className="block mb-2 text-white">Порядок отображения:</label>
              <input
                type="number"
                name="order"
                defaultValue={editing?.order || 0}
                className="w-full px-3 py-2 bg-gray-700 rounded text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={editing?.is_active !== false}
                className="mr-2 w-4 h-4"
              />
              <label className="text-white">Активен</label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditing(null)
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {banners.map((banner) => (
          <div key={banner.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2">
                  {banner.video_url ? (
                    <video
                      src={banner.video_url}
                      className="max-w-xs max-h-32 rounded"
                      controls
                    />
                  ) : banner.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={banner.image_url}
                      alt="Banner"
                      className="max-w-xs max-h-32 rounded object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-32 h-32 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                      Нет медиа
                    </div>
                  )}
                </div>
                <div className="text-sm space-y-1 text-white">
                  <div>
                    <strong>Ссылка:</strong> {banner.link || 'Нет'}
                  </div>
                  <div>
                    <strong>Порядок:</strong> {banner.order}
                  </div>
                  <div>
                    <strong>Статус:</strong>{' '}
                    <span className={banner.is_active ? 'text-green-400' : 'text-red-400'}>
                      {banner.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(banner)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
        {banners.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            Нет баннеров. Добавьте первый баннер.
          </div>
        )}
      </div>
    </div>
  )
}

