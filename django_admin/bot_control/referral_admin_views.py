from django.shortcuts import render, redirect
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.contrib import messages
from django.db.models import Q
from .referral_models import ReferralWithdrawalRequest
from django.conf import settings
import requests

@require_http_methods(["GET"]) 
def referral_history(request):
    status = request.GET.get('status')
    bookmaker = request.GET.get('bookmaker')
    qs = ReferralWithdrawalRequest.objects.all().order_by('-created_at')
    if status:
        qs = qs.filter(status=status)
    if bookmaker:
        qs = qs.filter(bookmaker=bookmaker)

    return render(request, 'referral/history.html', {
        'items': qs[:500],
        'status': status or '',
        'bookmaker': bookmaker or '',
        'status_choices': [('pending','Ожидает'), ('processing','В обработке'), ('completed','Выплачено'), ('rejected','Отклонено')],
        'bookmaker_choices': [('1xbet','1XBET'), ('1win','1WIN'), ('melbet','MELBET'), ('mostbet','MOSTBET')],
    })
