#!/usr/bin/env python3
"""
Web server for displaying referral top - universal bot
"""
import asyncio
import logging
import html
from datetime import datetime
from aiohttp import web
import sqlite3
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class UniversalReferralWebServer:
    def __init__(self, db_path: str = "universal_bot.db"):
        self.db_path = db_path
        self.app = web.Application()
        self.setup_routes()
        # Временно отключаем middleware для отладки
        # self.setup_middleware()
    
    def setup_routes(self):
        """Setup routes"""
        self.app.router.add_get('/', self.index_handler)
        self.app.router.add_get('/api/top', self.api_top_handler)
        self.app.router.add_get('/health', self.health_handler)
    
    def setup_middleware(self):
        """Setup middleware for security and error handling"""
        async def security_middleware(request, handler):
            # Add security headers
            response = await handler(request)
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['X-XSS-Protection'] = '1; mode=block'
            response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            return response
        
        # Используем правильный способ добавления middleware
        self.app.middlewares.append(security_middleware)
    
    def get_referral_top(self, limit: int = 20, period: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get referral top from database with optional period filtering"""
        try:
            # Validate limit
            if not isinstance(limit, int) or limit <= 0 or limit > 1000:
                limit = 20
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Base query with improved JOIN and filtering
            base_query = '''
                SELECT 
                    r.referrer_id,
                    u.username,
                    u.first_name,
                    u.last_name,
                    COUNT(DISTINCT r.referred_id) as referrals_count,
                    COALESCE(SUM(re.commission_amount), 0) as total_earnings,
                    u.created_at
                FROM referrals r
                LEFT JOIN users u ON r.referrer_id = u.user_id
                LEFT JOIN referral_earnings re ON r.referrer_id = re.referrer_id
            '''
            
            # Add period filtering if specified
            where_clause = ""
            params = []
            
            if period and period in ['month', 'week']:
                if period == 'month':
                    where_clause = "WHERE strftime('%Y-%m', u.created_at) = strftime('%Y-%m', 'now')"
                elif period == 'week':
                    where_clause = "WHERE u.created_at >= date('now', '-7 days')"
            
            query = f'''
                {base_query}
                {where_clause}
                GROUP BY r.referrer_id, u.username, u.first_name, u.last_name, u.created_at
                HAVING referrals_count > 0
                ORDER BY total_earnings DESC, referrals_count DESC
                LIMIT ?
            '''
            
            cursor.execute(query, params + [limit])
            top = cursor.fetchall()
            conn.close()
            
            if top:
                columns = ['referrer_id', 'username', 'first_name', 'last_name', 
                          'referrals_count', 'total_earnings', 'created_at']
                return [dict(zip(columns, row)) for row in top]
            return []
            
        except Exception as e:
            logger.error(f"Error getting top: {e}")
            return []
    
    def _generate_top_list(self, top_data: List[Dict[str, Any]]) -> str:
        """Generate HTML for top list with proper escaping and commission info"""
        if not top_data:
            return '<div class="no-results"><i class="fas fa-info-circle"></i><br>Пока нет данных о рефероводах</div>'
        
        html_parts = []
        for i, item in enumerate(top_data):
            rank = i + 1
            rank_class = ''
            rank_emoji = ''
            
            if rank == 1:
                rank_class = 'gold'
                rank_emoji = '🥇'
            elif rank == 2:
                rank_class = 'silver'
                rank_emoji = '🥈'
            elif rank == 3:
                rank_class = 'bronze'
                rank_emoji = '🥉'
            
            # Properly escape user data to prevent XSS
            username = html.escape(str(item.get('username') or item.get('first_name') or 'Без имени'))
            referrals_count = int(item.get('referrals_count', 0))
            total_earnings = float(item.get('total_earnings', 0))
            created_at = html.escape(str(item.get('created_at', 'Неизвестно')))
            referrer_id = int(item.get('referrer_id', 0))
            
            # Вычисляем потенциальный заработок (2% от депозитов рефералов)
            potential_earnings = total_earnings * 0.02  # 2% комиссия
            
            html_parts.append(f'''
                <div class="top-item" data-user-id="{referrer_id}">
                    <div class="rank {rank_class}">{rank_emoji or rank}</div>
                    <div class="user-info">
                        <div class="username">{username}</div>
                        <div class="user-stats">
                            <span><i class="fas fa-users"></i> Рефералов: {referrals_count}</span>
                            <span><i class="fas fa-calendar"></i> Дата: {created_at}</span>
                        </div>
                        <div class="commission-info">
                            <i class="fas fa-info-circle"></i> Получает 2% от депозитов рефералов
                        </div>
                    </div>
                    <div class="earnings">
                        <div class="earnings-amount">{total_earnings:,.0f} KGS</div>
                        <div class="earnings-label">Заработано</div>
                        <div style="font-size: 12px; color: #ffaa00; margin-top: 5px;">
                            +{potential_earnings:,.0f} KGS комиссия
                        </div>
                    </div>
                </div>
            ''')
        
        return ''.join(html_parts)
    
    async def index_handler(self, request):
        """Main page with enhanced UI and functionality"""
        try:
            # Get referral top data
            top_data = self.get_referral_top(50)  # Increased limit
            
            # Calculate statistics
            total_participants = len(top_data)
            total_earnings = sum(item.get('total_earnings', 0) for item in top_data)
            total_referrals = sum(item.get('referrals_count', 0) for item in top_data)
            avg_earnings = total_earnings / total_participants if total_participants > 0 else 0
            
            # Красивый дизайн с темной темой
            html_content = f"""
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
                <meta name="theme-color" content="#1a1a1a">
                <meta name="apple-mobile-web-app-capable" content="yes">
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
                <meta name="format-detection" content="telephone=no">
                <title>LUXON - ТОП рефероводов</title>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                <style>
                    * {{
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }}
                    
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%);
                        min-height: 100vh;
                        color: #ffffff;
                        padding: 20px;
                    }}
                    
                    .container {{
                        max-width: 1200px;
                        margin: 0 auto;
                        background: rgba(26, 26, 46, 0.95);
                        border-radius: 20px;
                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                        overflow: hidden;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }}
                    
                    .header {{
                        background: linear-gradient(135deg, #e94560 0%, #533483 100%);
                        color: white;
                        padding: 40px;
                        text-align: center;
                    }}
                    
                    .header h1 {{
                        font-size: 3rem;
                        margin-bottom: 10px;
                        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
                    }}
                    
                    .header p {{
                        font-size: 1.2rem;
                        opacity: 0.9;
                    }}
                    
                    .stats-grid {{
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        padding: 30px;
                        background: rgba(40, 40, 70, 0.7);
                    }}
                    
                    .stat-card {{
                        background: rgba(26, 26, 46, 0.8);
                        padding: 20px;
                        border-radius: 15px;
                        text-align: center;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        transition: transform 0.3s ease;
                    }}
                    
                    .stat-card:hover {{
                        transform: translateY(-5px);
                    }}
                    
                    .stat-value {{
                        font-size: 2.5rem;
                        font-weight: bold;
                        margin-bottom: 10px;
                        background: linear-gradient(45deg, #e94560, #533483);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }}
                    
                    .stat-label {{
                        color: #cccccc;
                        font-size: 14px;
                    }}
                    
                    .top-section {{
                        padding: 30px;
                    }}
                    
                    .top-section h2 {{
                        color: #00ff88;
                        margin-bottom: 20px;
                        font-size: 2rem;
                        text-align: center;
                    }}
                    
                    .top-list {{
                        display: grid;
                        gap: 15px;
                    }}
                    
                    .top-item {{
                        background: rgba(40, 40, 70, 0.7);
                        padding: 20px;
                        border-radius: 15px;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        display: flex;
                        align-items: center;
                        transition: all 0.3s ease;
                        backdrop-filter: blur(10px);
                    }}
                    
                    .top-item:hover {{
                        transform: translateX(10px);
                        border-color: #00ff88;
                        box-shadow: 0 10px 30px rgba(0, 255, 136, 0.2);
                    }}
                    
                    .rank {{
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.5rem;
                        font-weight: bold;
                        margin-right: 20px;
                        background: linear-gradient(45deg, #e94560, #533483);
                    }}
                    
                    .rank.gold {{
                        background: linear-gradient(45deg, #ffd700, #ffed4e);
                        color: #000;
                    }}
                    
                    .rank.silver {{
                        background: linear-gradient(45deg, #c0c0c0, #e8e8e8);
                        color: #000;
                    }}
                    
                    .rank.bronze {{
                        background: linear-gradient(45deg, #cd7f32, #daa520);
                        color: #fff;
                    }}
                    
                    .user-info {{
                        flex-grow: 1;
                    }}
                    
                    .username {{
                        font-size: 1.3rem;
                        font-weight: bold;
                        margin-bottom: 5px;
                        color: #ffffff;
                    }}
                    
                    .user-stats {{
                        display: flex;
                        gap: 20px;
                        color: #cccccc;
                        font-size: 14px;
                    }}
                    
                    .user-stats span {{
                        background: rgba(0, 0, 0, 0.3);
                        padding: 5px 10px;
                        border-radius: 10px;
                    }}
                    
                    .earnings {{
                        text-align: right;
                        min-width: 120px;
                    }}
                    
                    .earnings-amount {{
                        font-size: 1.5rem;
                        font-weight: bold;
                        color: #00ff88;
                        margin-bottom: 5px;
                    }}
                    
                    .earnings-label {{
                        font-size: 12px;
                        color: #888;
                    }}
                    
                    .commission-info {{
                        background: rgba(0, 255, 136, 0.1);
                        border: 1px solid #00ff88;
                        border-radius: 10px;
                        padding: 10px;
                        margin-top: 10px;
                        font-size: 12px;
                        color: #00ff88;
                    }}
                    
                    .no-results {{
                        text-align: center;
                        padding: 60px;
                        color: #888;
                        font-size: 1.2rem;
                    }}
                    
                    .refresh-btn {{
                        position: fixed;
                        bottom: 30px;
                        right: 30px;
                        background: linear-gradient(45deg, #e94560, #533483);
                        color: white;
                        border: none;
                        padding: 15px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 1.2rem;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                        transition: all 0.3s ease;
                    }}
                    
                    .refresh-btn:hover {{
                        transform: scale(1.1);
                        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
                    }}
                    
                    /* Мобильная версия для Telegram WebApp */
                    @media (max-width: 768px) {{
                        body {{
                            padding: 10px;
                            font-size: 14px;
                        }}
                        
                        .container {{
                            border-radius: 15px;
                            margin: 0;
                        }}
                        
                        .header {{
                            padding: 25px 20px;
                        }}
                        
                        .header h1 {{
                            font-size: 2.2rem;
                            margin-bottom: 8px;
                        }}
                        
                        .header p {{
                            font-size: 1rem;
                        }}
                        
                        .stats-grid {{
                            grid-template-columns: 1fr 1fr;
                            gap: 15px;
                            padding: 20px;
                        }}
                        
                        .stat-card {{
                            padding: 15px;
                            border-radius: 12px;
                        }}
                        
                        .stat-value {{
                            font-size: 2rem;
                        }}
                        
                        .stat-label {{
                            font-size: 12px;
                        }}
                        
                        .top-section {{
                            padding: 20px;
                        }}
                        
                        .top-section h2 {{
                            font-size: 1.5rem;
                            margin-bottom: 15px;
                        }}
                        
                        .top-list {{
                            gap: 12px;
                        }}
                        
                        .top-item {{
                            padding: 15px;
                            border-radius: 12px;
                            flex-direction: column;
                            text-align: center;
                            position: relative;
                        }}
                        
                        .top-item:hover {{
                            transform: none;
                        }}
                        
                        .rank {{
                            width: 50px;
                            height: 50px;
                            margin: 0 auto 12px auto;
                            font-size: 1.2rem;
                        }}
                        
                        .user-info {{
                            margin-bottom: 10px;
                        }}
                        
                        .username {{
                            font-size: 1.1rem;
                            margin-bottom: 8px;
                        }}
                        
                        .user-stats {{
                            flex-direction: column;
                            gap: 8px;
                            align-items: center;
                        }}
                        
                        .user-stats span {{
                            font-size: 12px;
                            padding: 4px 8px;
                        }}
                        
                        .commission-info {{
                            font-size: 11px;
                            padding: 8px;
                            margin-top: 8px;
                        }}
                        
                        .earnings {{
                            text-align: center;
                            min-width: auto;
                        }}
                        
                        .earnings-amount {{
                            font-size: 1.3rem;
                        }}
                        
                        .earnings-label {{
                            font-size: 11px;
                        }}
                        
                        .refresh-btn {{
                            bottom: 20px;
                            right: 20px;
                            padding: 12px;
                            font-size: 1rem;
                        }}
                    }}
                    
                    /* Очень маленькие экраны (iPhone SE и меньше) */
                    @media (max-width: 375px) {{
                        .stats-grid {{
                            grid-template-columns: 1fr;
                        }}
                        
                        .header h1 {{
                            font-size: 1.8rem;
                        }}
                        
                        .stat-value {{
                            font-size: 1.8rem;
                        }}
                    }}
                    
                    /* Telegram WebApp специфичные стили */
                    @media (max-width: 480px) {{
                        body {{
                            /* Убираем отступы для полноэкранного режима в Telegram */
                            padding: 5px;
                        }}
                        
                        .container {{
                            border-radius: 10px;
                        }}
                        
                        .header {{
                            padding: 20px 15px;
                        }}
                        
                        .top-section {{
                            padding: 15px;
                        }}
                        
                        .top-item {{
                            padding: 12px;
                            border-radius: 10px;
                        }}
                        
                        /* Увеличиваем размеры кнопок для тач-интерфейса */
                        .refresh-btn {{
                            padding: 15px;
                            font-size: 1.1rem;
                        }}
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1><i class="fas fa-trophy"></i> ТОП рефероводов</h1>
                        <p>Luxon - Зарабатывайте вместе с нами!</p>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">{total_participants}</div>
                            <div class="stat-label">Участников</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">{total_earnings:,.0f}</div>
                            <div class="stat-label">Общий заработок (KGS)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">{total_referrals}</div>
                            <div class="stat-label">Всего рефералов</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">{avg_earnings:,.0f}</div>
                            <div class="stat-label">Средний заработок (KGS)</div>
                        </div>
                    </div>
                    
                    <div class="top-section">
                        <h2><i class="fas fa-crown"></i> Лучшие рефероводы</h2>
                        <div class="top-list" id="top-content">
                    {self._generate_top_list(top_data)}
                        </div>
                    </div>
                </div>
                
                <button class="refresh-btn" onclick="location.reload()" title="Обновить">
                    <i class="fas fa-sync-alt"></i>
                </button>
                
                <script>
                    // Telegram WebApp поддержка
                    if (window.Telegram && window.Telegram.WebApp) {{
                        const tg = window.Telegram.WebApp;
                        tg.ready();
                        tg.expand();
                        
                        // Устанавливаем цвет темы
                        tg.setHeaderColor('#1a1a1a');
                        tg.setBackgroundColor('#0a0a0a');
                    }}
                    
                    // Предотвращаем зум на мобильных устройствах
                    document.addEventListener('gesturestart', function (e) {{
                        e.preventDefault();
                    }});
                    
                    document.addEventListener('gesturechange', function (e) {{
                        e.preventDefault();
                    }});
                    
                    document.addEventListener('gestureend', function (e) {{
                        e.preventDefault();
                    }});
                    
                    // Улучшенная кнопка обновления для мобильных
                    const refreshBtn = document.querySelector('.refresh-btn');
                    if (refreshBtn) {{
                        refreshBtn.addEventListener('touchstart', function(e) {{
                            e.preventDefault();
                            this.style.transform = 'scale(0.95)';
                        }});
                        
                        refreshBtn.addEventListener('touchend', function(e) {{
                            e.preventDefault();
                            this.style.transform = 'scale(1)';
                            setTimeout(() => location.reload(), 100);
                        }});
                    }}
                    
                    // Автообновление каждые 30 секунд
                    setInterval(() => location.reload(), 30000);
                    
                    // Добавляем вибрацию при клике на карточки (если поддерживается)
                    const topItems = document.querySelectorAll('.top-item');
                    topItems.forEach(item => {{
                        item.addEventListener('click', function() {{
                            if (navigator.vibrate) {{
                                navigator.vibrate(50);
                            }}
                        }});
                    }});
                </script>
            </body>
            </html>
            """
            
            return web.Response(text=html_content, content_type='text/html')
            
        except Exception as e:
            logger.error(f"Error in index handler: {e}")
            return web.Response(text="Error loading page", status=500)
    
    async def api_top_handler(self, request):
        """API endpoint for top data with validation"""
        try:
            # Get and validate limit parameter
            limit_param = request.query.get('limit', '20')
            try:
                limit = int(limit_param)
                if limit <= 0 or limit > 1000:
                    limit = 20
            except ValueError:
                limit = 20
            
            # Get and validate period parameter
            period = request.query.get('period')
            if period and period not in ['all', 'month', 'week']:
                period = 'all'
            
            top = self.get_referral_top(limit, period)
            
            response_data = {
                'success': True,
                'top': top,
                'timestamp': datetime.now().isoformat(),
                'limit': limit,
                'period': period or 'all'
            }
            
            return web.json_response(response_data)
            
        except Exception as e:
            logger.error(f"API error: {e}")
            return web.json_response({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }, status=500)
    
    async def health_handler(self, request):
        """Health check endpoint"""
        try:
            # Test database connection
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            conn.close()
            
            return web.json_response({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'database': 'connected'
            })
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return web.json_response({
                'status': 'unhealthy',
                'timestamp': datetime.now().isoformat(),
                'database': 'disconnected',
                'error': str(e)
            }, status=503)

async def main():
    """Main function with error handling"""
    try:
        server = UniversalReferralWebServer()
        
        runner = web.AppRunner(server.app)
        await runner.setup()
        
        site = web.TCPSite(runner, 'localhost', 8080)
        await site.start()
        
        logger.info("Web server started at http://localhost:8080")
        
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            logger.info("Web server stopped by user")
        finally:
            await runner.cleanup()
            
    except Exception as e:
        logger.error(f"Failed to start web server: {e}")
        raise

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
