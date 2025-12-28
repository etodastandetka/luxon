'use client'

import React, { useEffect, useRef, useState } from 'react'

interface Logo3DProps {
  className?: string
}

const Logo3D: React.FC<Logo3DProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Предзагружаем OBJ файл сразу при монтировании компонента
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.as = 'fetch'
    link.href = '/logo.obj'
    document.head.appendChild(link)

    let animationFrameId: number
    let scene: any, camera: any, renderer: any, logoModel: any
    let mounted = true

    const initThree = async () => {
      try {
        // Загружаем Three.js и OBJLoader параллельно для ускорения
        const [THREE, { OBJLoader }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/OBJLoader.js')
        ])

        if (!containerRef.current || !mounted) return

        // Scene setup
        scene = new THREE.Scene()
        scene.background = null // Прозрачный фон
        
        // Camera setup
        const width = containerRef.current.clientWidth
        const height = containerRef.current.clientHeight || 280
        camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
        camera.position.set(0, 0, 5)
        
        // Renderer setup
        renderer = new THREE.WebGLRenderer({ 
          antialias: true,
          alpha: true // Прозрачный фон
        })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        
        containerRef.current.appendChild(renderer.domElement)

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        scene.add(ambientLight)

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight1.position.set(5, 5, 5)
        scene.add(directionalLight1)

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
        directionalLight2.position.set(-5, -5, -5)
        scene.add(directionalLight2)

        // Load OBJ model immediately with priority
        const loader = new OBJLoader()
        
        // Загружаем модель сразу с высоким приоритетом
        loader.load(
          '/logo.obj',
          (object: any) => {
            if (!mounted) return

            logoModel = object

            // Центрируем модель
            const box = new THREE.Box3().setFromObject(object)
            const center = box.getCenter(new THREE.Vector3())
            const size = box.getSize(new THREE.Vector3())
            const maxDim = Math.max(size.x, size.y, size.z)
            const scale = 3.2 / maxDim // Оптимальный размер логотипа
            
            object.traverse((child: any) => {
              if (child.isMesh) {
                const childBox = new THREE.Box3().setFromObject(child)
                const childCenter = childBox.getCenter(new THREE.Vector3())
                
                // Вычитаем центр модели для получения относительной позиции
                const relativeX = childCenter.x - center.x
                const relativeY = childCenter.y - center.y
                
                // Буква O находится примерно в центре слова LUXON
                // Настраиваем параметры в зависимости от реальной модели
                // Если модель разделена на отдельные меши, это сработает
                const isO = relativeX > -0.6 && relativeX < 0.6 && 
                           relativeY > -0.6 && relativeY < 0.6
                
                if (isO) {
                  // Зеленый цвет для буквы O (и символа ON внутри, если он часть O)
                  child.material = new THREE.MeshPhongMaterial({
                    color: 0x22c55e, // green-500
                    shininess: 100,
                    specular: 0x222222
                  })
                } else {
                  // Белый цвет для остальных букв
                  child.material = new THREE.MeshPhongMaterial({
                    color: 0xffffff, // белый
                    shininess: 100,
                    specular: 0x222222
                  })
                }
                
                child.geometry.computeVertexNormals()
              }
            })

            // Применяем трансформации
            object.position.sub(center)
            object.scale.multiplyScalar(scale)
            object.rotation.y = 0

            scene.add(object)
          },
          (xhr: any) => {
            // Прогресс загрузки (опционально)
            if (xhr.lengthComputable) {
              const percentComplete = (xhr.loaded / xhr.total) * 100
              console.log('Logo loading: ' + Math.round(percentComplete) + '%')
            }
          },
          (error: any) => {
            console.error('Error loading logo:', error)
            // Fallback - показываем простое сообщение
            if (containerRef.current) {
              containerRef.current.innerHTML = '<div class="text-white/50 text-center py-8">Logo loading error</div>'
            }
          }
        )

        // Handle resize
        const handleResize = () => {
          if (!containerRef.current || !mounted) return
          const width = containerRef.current.clientWidth
          const height = containerRef.current.clientHeight || 280
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          renderer.setSize(width, height)
        }
        window.addEventListener('resize', handleResize)

        // Переменные для ручного вращения
        let isDragging = false
        let previousMousePosition = { x: 0, y: 0 }
        let rotationX = 0
        let rotationY = 0

        // Обработчики для мыши
        const onMouseDown = (e: MouseEvent) => {
          isDragging = true
          previousMousePosition = { x: e.clientX, y: e.clientY }
        }

        const onMouseMove = (e: MouseEvent) => {
          if (!isDragging || !logoModel) return
          
          const deltaX = e.clientX - previousMousePosition.x
          const deltaY = e.clientY - previousMousePosition.y
          
          rotationY += deltaX * 0.01
          rotationX += deltaY * 0.01
          
          logoModel.rotation.y = rotationY
          logoModel.rotation.x = rotationX
          
          previousMousePosition = { x: e.clientX, y: e.clientY }
        }

        const onMouseUp = () => {
          isDragging = false
        }

        // Обработчики для тач-событий
        const onTouchStart = (e: TouchEvent) => {
          if (e.touches.length === 1) {
            isDragging = true
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          }
        }

        const onTouchMove = (e: TouchEvent) => {
          if (!isDragging || !logoModel || e.touches.length !== 1) return
          
          const deltaX = e.touches[0].clientX - previousMousePosition.x
          const deltaY = e.touches[0].clientY - previousMousePosition.y
          
          rotationY += deltaX * 0.01
          rotationX += deltaY * 0.01
          
          logoModel.rotation.y = rotationY
          logoModel.rotation.x = rotationX
          
          previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }

        const onTouchEnd = () => {
          isDragging = false
        }

        // Добавляем обработчики событий
        if (containerRef.current) {
          containerRef.current.addEventListener('mousedown', onMouseDown)
          window.addEventListener('mousemove', onMouseMove)
          window.addEventListener('mouseup', onMouseUp)
          containerRef.current.addEventListener('touchstart', onTouchStart)
          containerRef.current.addEventListener('touchmove', onTouchMove)
          containerRef.current.addEventListener('touchend', onTouchEnd)
        }

        // Animation loop (без автоматического вращения)
        const animate = () => {
          if (!mounted) return
          animationFrameId = requestAnimationFrame(animate)

          // Просто рендерим сцену, без автоматического вращения
          renderer.render(scene, camera)
        }

        animate()

        // Сохраняем ссылки на обработчики для cleanup
        const cleanup = () => {
          window.removeEventListener('resize', handleResize)
          if (containerRef.current) {
            containerRef.current.removeEventListener('mousedown', onMouseDown)
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
            containerRef.current.removeEventListener('touchstart', onTouchStart)
            containerRef.current.removeEventListener('touchmove', onTouchMove)
            containerRef.current.removeEventListener('touchend', onTouchEnd)
          }
        }
        
        return cleanup
      } catch (error) {
        console.error('Error initializing 3D logo:', error)
      }
    }

    initThree()

    return () => {
      mounted = false
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (renderer && containerRef.current) {
        try {
          renderer.dispose()
          if (containerRef.current && renderer.domElement) {
            containerRef.current.removeChild(renderer.domElement)
          }
        } catch (e) {
          console.error('Error cleaning up renderer:', e)
        }
      }
    }
  }, [])

    return (
      <div 
        ref={containerRef}
        className={`w-full ${className}`}
        style={{ 
          height: '280px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '280px',
          cursor: 'grab'
        }}
        onMouseDown={(e) => {
          if (containerRef.current) {
            containerRef.current.style.cursor = 'grabbing'
          }
        }}
        onMouseUp={() => {
          if (containerRef.current) {
            containerRef.current.style.cursor = 'grab'
          }
        }}
      >
      </div>
    )
}

export default Logo3D

