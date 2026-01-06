'use client'

import React, { useEffect, useRef } from 'react'

interface ThreeLuxonIntroProps {
  width?: number
  height?: number
}

const ThreeLuxonIntro: React.FC<ThreeLuxonIntroProps> = ({ 
  width = 800, 
  height = 600 
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let animationFrameId: number
    let scene: any, camera: any, renderer: any
    let particles: any

    const initThree = async () => {
      const THREE = await import('three')

      if (!containerRef.current) return

      // Scene setup
      scene = new THREE.Scene()
      
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
      camera.position.z = 50

      renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false
      })
      renderer.setSize(window.innerWidth, window.innerHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x0a0a0a, 1)
      
      containerRef.current.appendChild(renderer.domElement)

      // Создаем звездное небо
      const starCount = 3000
      const particleGeometry = new THREE.BufferGeometry()
      const positions = new Float32Array(starCount * 3)
      const colors = new Float32Array(starCount * 3)
      const sizes = new Float32Array(starCount)

      for (let i = 0; i < starCount; i++) {
        const i3 = i * 3
        
        // Распределяем звезды в большом пространстве
        const radius = 150 + Math.random() * 200
        const theta = Math.random() * Math.PI * 2
        const phi = Math.random() * Math.PI
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = radius * Math.cos(phi)

        // Цвета звезд: белые с легким оттенком
        const color = new THREE.Color()
        const brightness = 0.7 + Math.random() * 0.3
        const temp = Math.random()
        
        if (temp < 0.3) {
          // Голубоватые звезды
          color.setRGB(brightness * 0.9, brightness * 0.95, brightness)
        } else if (temp < 0.6) {
          // Белые звезды
          color.setRGB(brightness, brightness, brightness)
        } else {
          // Слегка желтоватые звезды
          color.setRGB(brightness, brightness * 0.95, brightness * 0.9)
        }
        
        colors[i3] = color.r
        colors[i3 + 1] = color.g
        colors[i3 + 2] = color.b

        // Разные размеры звезд
        sizes[i] = Math.random() * 2 + 0.5
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

      const particleMaterial = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      })

      particles = new THREE.Points(particleGeometry, particleMaterial)
      scene.add(particles)

      const lines: any[] = []

      // Обработка изменения размера окна
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', handleResize)

      // Animation
      let time = 0
      const animate = () => {
        animationFrameId = requestAnimationFrame(animate)
        time += 0.0005

        // Очень медленное вращение звездного неба
        if (particles) {
          particles.rotation.y = time * 0.2
          
          // Легкое мерцание звезд
          const sizes = particles.geometry.attributes.size.array as Float32Array
          for (let i = 0; i < sizes.length; i++) {
            sizes[i] += Math.sin(time * 5 + i) * 0.02
          }
          particles.geometry.attributes.size.needsUpdate = true
        }

        // Минимальное движение камеры для параллакса
        camera.position.x = Math.sin(time * 0.5) * 3
        camera.position.y = Math.cos(time * 0.3) * 2
        camera.lookAt(scene.position)

        renderer.render(scene, camera)
      }

      animate()

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    initThree()

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (renderer) {
        renderer.dispose()
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement)
        }
      }
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        backgroundColor: '#0a0a0a'
      }}
    />
  )
}

export default ThreeLuxonIntro
