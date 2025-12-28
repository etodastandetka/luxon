'use client'

import React, { useEffect, useRef, useState } from 'react'

interface Logo3DProps {
  className?: string
}

const Logo3D: React.FC<Logo3DProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Загружаем 3D модель только после загрузки страницы и когда компонент виден
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 1000) // Задержка 1 секунда после загрузки страницы

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isVisible || typeof window === 'undefined') return

    let animationFrameId: number
    let scene: any, camera: any, renderer: any, logoModel: any
    let mounted = true

    const initThree = async () => {
      try {
        const THREE = await import('three')
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')

        if (!containerRef.current || !mounted) return

        // Scene setup
        scene = new THREE.Scene()
        scene.background = null // Прозрачный фон
        
        // Camera setup
        const width = containerRef.current.clientWidth
        const height = containerRef.current.clientHeight || 300
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

        // Load OBJ model with delay to not block page loading
        const loader = new OBJLoader()
        
        // Загружаем модель с задержкой после инициализации сцены
        setTimeout(() => {
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
            const scale = 3 / maxDim // Масштабируем чтобы модель поместилась
            
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
        }, 500) // Задержка 500мс для неблокирующей загрузки

        // Handle resize
        const handleResize = () => {
          if (!containerRef.current || !mounted) return
          const width = containerRef.current.clientWidth
          const height = containerRef.current.clientHeight || 300
          camera.aspect = width / height
          camera.updateProjectionMatrix()
          renderer.setSize(width, height)
        }
        window.addEventListener('resize', handleResize)

        // Animation loop
        const animate = () => {
          if (!mounted) return
          animationFrameId = requestAnimationFrame(animate)

          // Вращение на 360 градусов (медленное и плавное)
          if (logoModel) {
            logoModel.rotation.y += 0.005 // Медленное вращение
          }

          renderer.render(scene, camera)
        }

        animate()

        return () => {
          window.removeEventListener('resize', handleResize)
        }
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
  }, [isVisible])

    return (
      <div 
        ref={containerRef}
        className={`w-full ${className}`}
        style={{ 
          height: '300px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: '300px'
        }}
      >
      </div>
    )
}

export default Logo3D

