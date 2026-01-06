import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Telegram Login Widget отправляет данные через GET параметры
    const id = searchParams.get('id')
    const firstName = searchParams.get('first_name')
    const lastName = searchParams.get('last_name')
    const username = searchParams.get('username')
    const photoUrl = searchParams.get('photo_url')
    const authDate = searchParams.get('auth_date')
    const hash = searchParams.get('hash')
    
    if (!id || !authDate || !hash) {
      return NextResponse.redirect(new URL('/?auth_error=invalid_data', request.url))
    }

    // Проверяем, что данные не слишком старые (в течение 24 часов)
    const authDateNum = parseInt(authDate)
    const currentTime = Math.floor(Date.now() / 1000)
    const maxAge = 24 * 60 * 60 // 24 часа
    
    if (currentTime - authDateNum > maxAge) {
      return NextResponse.redirect(new URL('/?auth_error=expired', request.url))
    }

    // Формируем объект пользователя
    const userData = {
      id: parseInt(id),
      first_name: firstName || '',
      last_name: lastName || null,
      username: username || null,
      photo_url: photoUrl || null,
      auth_date: authDateNum,
    }

    // Создаем HTML страницу, которая сохранит данные и закроется
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Авторизация через Telegram</title>
        </head>
        <body>
          <script>
            try {
              const userData = ${JSON.stringify(userData)};
              
              // Сохраняем данные пользователя в localStorage
              localStorage.setItem('telegram_user', JSON.stringify(userData));
              localStorage.setItem('telegram_user_id', userData.id.toString());
              
              // Закрываем окно или редиректим на главную
              if (window.opener) {
                // Если открыто в popup
                window.opener.postMessage({ type: 'telegram_auth_success', user: userData }, '*');
                window.close();
              } else {
                // Если открыто в новой вкладке
                window.location.href = '/';
              }
            } catch (error) {
              console.error('Error saving user data:', error);
              window.location.href = '/?auth_error=save_failed';
            }
          </script>
          <p>Авторизация успешна. Закрываю окно...</p>
        </body>
      </html>
    `

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('Error processing Telegram auth:', error)
    return NextResponse.redirect(new URL('/?auth_error=server_error', request.url))
  }
}

