from rest_framework import serializers
from .models import (
    BotSettings, BroadcastMessage, BankSettings, QRHash,
    BotDepositRequest, BotWithdrawRequest, BotConfiguration
)
from .referral_models import ReferralWithdrawalRequest, ReferralRequestsBoard
from .bot_models import BotUser, BotTransaction, BotDepositRequestRaw, BotWithdrawRequestRaw

class BotSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotSettings
        fields = '__all__'

class BroadcastMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BroadcastMessage
        fields = '__all__'

class BankSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankSettings
        fields = '__all__'

class QRHashSerializer(serializers.ModelSerializer):
    class Meta:
        model = QRHash
        fields = '__all__'

class BotDepositRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotDepositRequest
        fields = '__all__'

class BotWithdrawRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotWithdrawRequest
        fields = '__all__'

class BotConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotConfiguration
        fields = '__all__'

class ReferralWithdrawalRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralWithdrawalRequest
        fields = '__all__'

class ReferralRequestsBoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferralRequestsBoard
        fields = '__all__'

class BotUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotUser
        fields = '__all__'

class BotTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotTransaction
        fields = '__all__'

class BotDepositRequestRawSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotDepositRequestRaw
        fields = '__all__'

class BotWithdrawRequestRawSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotWithdrawRequestRaw
        fields = '__all__'

class TransactionStatsSerializer(serializers.Serializer):
    total_deposits = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_withdrawals = serializers.DecimalField(max_digits=10, decimal_places=2)
    pending_deposits = serializers.IntegerField()
    pending_withdrawals = serializers.IntegerField()
    completed_deposits = serializers.IntegerField()
    completed_withdrawals = serializers.IntegerField()

class UserStatsSerializer(serializers.Serializer):
    total_users = serializers.IntegerField()
    active_users = serializers.IntegerField()
    new_users_today = serializers.IntegerField()
    new_users_this_week = serializers.IntegerField()