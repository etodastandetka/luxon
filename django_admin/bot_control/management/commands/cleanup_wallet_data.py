from django.core.management.base import BaseCommand
from bot_control.models import BankSettings, QRHash

TEST_BANK_CODE_PREFIXES = ("demo", "test")
TEST_BANK_NAME_PREFIXES = ("test", "demo")
TEST_QR_NAME_MARKERS = ("test", "demo")
TEST_QR_EMAIL_MARKERS = ("test@", ".test@")

class Command(BaseCommand):
    help = "Cleanup wallet data: delete demo/test banks and QR hashes. Use --nuke to delete ALL banks and QRs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Preview only, do not delete.",
        )
        parser.add_argument(
            "--nuke",
            action="store_true",
            dest="nuke",
            help="Delete ALL BankSettings and QRHash rows (irreversible).",
        )

    def handle(self, *args, **opts):
        dry = opts.get("dry_run", False)
        nuke = opts.get("nuke", False)

        if nuke:
            banks_qs = BankSettings.objects.all()
            qrs_qs = QRHash.objects.all()
        else:
            # Heuristics for demo/test
            # Banks
            banks_qs = BankSettings.objects.none()
            for pref in TEST_BANK_CODE_PREFIXES:
                banks_qs = banks_qs.union(BankSettings.objects.filter(bank_code__istartswith=pref))
            for pref in TEST_BANK_NAME_PREFIXES:
                banks_qs = banks_qs.union(BankSettings.objects.filter(bank_name__istartswith=pref))

            # QR (account_name or email contain demo/test)
            qrs_qs = QRHash.objects.none()
            for mk in TEST_QR_NAME_MARKERS:
                qrs_qs = qrs_qs.union(QRHash.objects.filter(account_name__icontains=mk))
            for mk in TEST_QR_EMAIL_MARKERS:
                qrs_qs = qrs_qs.union(QRHash.objects.filter(gmail_email__icontains=mk))

        banks_count = banks_qs.count()
        qrs_count = qrs_qs.count()

        self.stdout.write(self.style.WARNING(f"Preview: banks={banks_count}, qr_hashes={qrs_count}"))

        if dry:
            self.stdout.write(self.style.SUCCESS("Dry-run complete. Nothing deleted."))
            return

        deleted = {"banks": 0, "qr_hashes": 0}
        # Delete QR first to avoid potential FK issues (if present)
        qr_ids = list(qrs_qs.values_list("id", flat=True))
        if qr_ids:
            deleted["qr_hashes"] = QRHash.objects.filter(id__in=qr_ids).delete()[0]
        bank_ids = list(banks_qs.values_list("id", flat=True))
        if bank_ids:
            deleted["banks"] = BankSettings.objects.filter(id__in=bank_ids).delete()[0]

        self.stdout.write(self.style.SUCCESS(f"Deleted: {deleted}"))
