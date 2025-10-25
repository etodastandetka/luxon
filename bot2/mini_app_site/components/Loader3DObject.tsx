"use client"
import { useEffect, useRef } from 'react'

interface Loader3DObjectProps {
  size?: number
  className?: string
}

export default function Loader3DObject({ size = 200, className = '' }: Loader3DObjectProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)
  const rendererRef = useRef<any>(null)
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const initThreeJS = async () => {
      // Динамический импорт Three.js
      const THREE = await import('three')
      
      const container = containerRef.current
      if (!container) return

      // Создаем сцену
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x000000)
      sceneRef.current = scene

      // Создаем камеру
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      camera.position.z = 4
      camera.position.y = 0
      camera.position.x = 0

      // Создаем рендерер
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
      })
      renderer.setSize(size, size)
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      rendererRef.current = renderer

        // Загружаем 3D модель
        const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js')
        const loader = new OBJLoader()
      
      try {
        const object = await new Promise<any>((resolve, reject) => {
          loader.load('/base.obj', resolve, undefined, reject)
        })

        // Создаем материал с анимацией цветов
        const material = new THREE.MeshPhongMaterial({
          color: 0xff0000,
          shininess: 100,
          transparent: true,
          opacity: 0.9
        })

        // Применяем материал ко всем мешам
        object.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.material = material
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        // Масштабируем объект (делаем еще больше)
        object.scale.setScalar(1.5)
        // Центрируем объект
        object.position.set(0, 0, 0)
        scene.add(object)

        // Добавляем освещение
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2)
        directionalLight.position.set(0, 5, 5)
        directionalLight.castShadow = true
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        scene.add(directionalLight)

        // Добавляем рендерер в контейнер
        container.appendChild(renderer.domElement)

        // Анимация - простое вращение на 360 градусов
        const animate = () => {
          animationRef.current = requestAnimationFrame(animate)
          
          // Простое вращение по Y оси (очень медленно)
          object.rotation.y += 0.005

          // Анимация цвета
          const time = Date.now() * 0.001
          const hue = (time * 0.1) % 1
          material.color.setHSL(hue, 0.8, 0.6)

          renderer.render(scene, camera)
        }

        animate()

        // Обработка изменения размера
        const handleResize = () => {
          const newSize = Math.min(window.innerWidth * 0.3, size)
          renderer.setSize(newSize, newSize)
          camera.aspect = 1
          camera.updateProjectionMatrix()
        }

        window.addEventListener('resize', handleResize)

        // Очистка при размонтировании
        return () => {
          window.removeEventListener('resize', handleResize)
          if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current)
          }
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement)
          }
          renderer.dispose()
        }
      } catch (error) {
        console.error('Error loading 3D model:', error)
        
        // Fallback: создаем простой куб если модель не загрузилась
        const geometry = new THREE.BoxGeometry(1, 1, 1)
        const material = new THREE.MeshPhongMaterial({ 
          color: 0xff0000,
          shininess: 100
        })
        const cube = new THREE.Mesh(geometry, material)
        cube.castShadow = true
        cube.receiveShadow = true
        scene.add(cube)

        const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
        directionalLight.position.set(5, 5, 5)
        scene.add(directionalLight)

        container.appendChild(renderer.domElement)

        const animate = () => {
          animationRef.current = requestAnimationFrame(animate)
          
          // Простое вращение по Y оси (очень медленно)
          cube.rotation.y += 0.005

          const time = Date.now() * 0.001
          const hue = (time * 0.1) % 1
          material.color.setHSL(hue, 0.8, 0.6)

          renderer.render(scene, camera)
        }

        animate()
      }
    }

    initThreeJS()
  }, [size])

  return (
    <div 
      ref={containerRef}
      className={`flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        perspective: '1000px',
        perspectiveOrigin: 'center center'
      }}
    />
  )
}
