"use client"
import { useState, useEffect, useMemo, memo } from 'react'

interface BeautifulTimerProps {
  timeLeft: number
  totalTime: number
}

function BeautifulTimer({ timeLeft, totalTime }: BeautifulTimerProps) {
  // Используем useMemo для вычисления минут и секунд
  const { minutes, seconds } = useMemo(() => ({
    minutes: Math.floor(timeLeft / 60),
    seconds: timeLeft % 60
  }), [timeLeft])

  return (
    <div className="App">
      <Marker type="minutes" time={minutes} measurement={5} />
      <Marker type="seconds" time={seconds} measurement={60} />
      <div className="text-overlay">
        <Timer type="minutes" time={minutes} />
        <Timer type="seconds" time={seconds} />
      </div>
      
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css?family=Oswald:700');
        
        .App {
          width: 100%;
          height: 156px;
          display: flex;
          background: #000000;
          position: relative;
          font-family: 'Oswald';
          font-weight: 700;
        }
        
        .text-overlay {
          position: absolute;
          z-index: 1;
          height: 100%;
          width: 100%;
          color: white;
          display: flex;
          align-items: center;
          font-size: 160px;
          box-sizing: border-box;
        }
        
        .text-overlay div {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 0 auto;
          width: 25%;
        }
        
        
        .Column {
          height: 156px;
          flex: 1 0 auto;
          position: relative;
          mix-blend-mode: multiply;
          z-index: 2;
          align-items: center;
        }
        
        .Marker {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          background: #019CDF;
          opacity: 1;
          border-radius: 2px;
          overflow: hidden;
          animation: hueylewisandthenews 10s infinite;
        }
        
        .Marker--seconds {
          transition: height 1s linear;
        }
        
        .Marker::before {
          height: 20px;
          width: calc(760px * 2);
          background-image: url(https://s3-us-west-2.amazonaws.com/s.cdpn.io/557257/wave.jpg);
          position: absolute;
          top: 0px;
          content: '';
          animation: wave 10s infinite linear;
        }
        
        .Marker::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 20px;
          background: linear-gradient(90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.3) 25%, 
            rgba(255, 255, 255, 0.6) 50%, 
            rgba(255, 255, 255, 0.3) 75%, 
            transparent 100%
          );
          animation: shimmer 3s infinite linear;
        }
        
        @keyframes wave {
          0% {
            left: 0;
          }
          100% {
            left: -760px;
          }
        }
        
        @keyframes hueylewisandthenews {
          0% {
            filter: hue-rotate(0deg);
          }
          50% {
            filter: hue-rotate(-30deg);
          }
          100% {
            filter: hue-rotate(0deg);
          }
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
      `}</style>
    </div>
  )
}

function Marker({ type, time, measurement }: { type: string, time: number, measurement: number }) {
  const offset = (time / measurement) * 100 + '%'
  const opacity = (time / measurement * 100) / 100
  
  return (
    <div className="Column">
      <div 
        className={`Marker Marker--${type}`} 
        style={{height: offset, opacity: opacity}}
      ></div>
    </div>
  )
}

function Timer({ type, time }: { type: string, time: number }) {
  const displayTime = time < 10 ? '0' + time : time.toString()
  return <div className={type}>{displayTime}</div>
}

export default memo(BeautifulTimer)

