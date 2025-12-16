import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-helpers'
import { createApiResponse } from '@/lib/api-helpers'
import { 
  generateSecret, 
  generateQRCode, 
  generateBackupCodes,
  is2FAEnabled 
} from '@/lib/two-factor'

/**
 * GET /api/auth/2fa/setup
 * Генерирует секрет и QR код для настройки 2FA
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)

    if (!authUser) {
      return NextResponse.json(
        createApiResponse(null, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Проверяем, не включена ли уже 2FA
    const alreadyEnabled = await is2FAEnabled(authUser.userId)
    if (alreadyEnabled) {
      return NextResponse.json(
        createApiResponse(null, '2FA is already enabled'),
        { status: 400 }
      )
    }

    // Генерируем секрет
    const secret = generateSecret()
    
    // Генерируем QR код
    const qrCode = await generateQRCode(secret, authUser.username)
    
    // Генерируем резервные коды
    const backupCodes = generateBackupCodes(10)

    return NextResponse.json(
      createApiResponse({
        secret,
        qrCode,
        backupCodes, // Возвращаем только один раз при настройке
        message: 'Scan QR code with authenticator app and save backup codes',
      })
    )
  } catch (error: any) {
    return NextResponse.json(
      createApiResponse(null, error.message || 'Failed to setup 2FA'),
      { status: 500 }
    )
  }
}

