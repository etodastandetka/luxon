# ... existing code ...

@csrf_exempt
def api_bot_settings(request):
    """API для получения настроек бота"""
    if request.method == 'GET':
        try:
            # Возвращаем базовые настройки
            settings_data = {
                'success': True,
                'settings': {
                    'bot_name': 'LUXON',
                    'welcome_message': 'Добро пожаловать!',
                    'platform_description': 'Платформа для пополнения и вывода средств в казино',
                    'supported_bookmakers': ['1xBet', 'Melbet', 'Mostbet', '1Win'],
                    'supported_banks': ['DemirBank', 'O! bank', 'Balance.kg', 'Bakai', 'MegaPay', 'MBank'],
                    'min_deposit': 35,
                    'max_deposit': 100000,
                    'min_withdraw': 100,
                    'max_withdraw': 50000,
                    'referral_percentage': 5,
                    'support_contact': '@luxon_support'
                }
            }
            return JsonResponse(settings_data)
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)