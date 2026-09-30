#!/usr/bin/env python3
"""Patch remaining customer toast surfaces."""
from pathlib import Path

ROOT = Path("/opt/m-live/apps/frontend/src")

HOOKS = "\n  const tn = useTranslations('common.notifications');\n  const tt = useTranslations('account.toasts');"


def ensure_hooks(text: str, after: str) -> str:
    if "const tt = useTranslations('account.toasts')" in text:
        return text
    if "useTranslations" not in text:
        text = text.replace("'use client';\n", "'use client';\n\nimport { useTranslations } from 'next-intl';\n")
    return text.replace(after, after + HOOKS, 1)


def patch(path: Path, after_hook: str, reps: list[tuple[str, str]], add_translations_import=True):
    text = path.read_text(encoding="utf-8")
    if add_translations_import and "useTranslations" not in text:
        text = text.replace("'use client';\n", "'use client';\n\nimport { useTranslations } from 'next-intl';\n")
    text = ensure_hooks(text, after_hook)
    for o, n in reps:
        if o not in text:
            print(f"MISS {path.name}: {o[:55]}")
        else:
            text = text.replace(o, n)
    path.write_text(text, encoding="utf-8")


# account/page.tsx
patch(
    ROOT / "app/dashboard/account/page.tsx",
    "  const ta = useTranslations('account');",
    [
        ("toast({ title: 'Cannot link', description: json.error?.message || 'Google sign-in is not configured.', variant: 'destructive' });",
         "toast({ title: tt('cannotLinkGoogle'), description: json.error?.message || tt('googleNotConfigured'), variant: 'destructive' });"),
        ("toast({ title: 'Error', description: 'Failed to start Google linking.', variant: 'destructive' });",
         "toast({ title: tn('errorTitle'), description: tt('googleLinkStartFailed'), variant: 'destructive' });"),
        ("toast({ title: 'Google unlinked', variant: 'success' });",
         "toast({ title: tt('googleUnlinked'), variant: 'success' });"),
        ("toast({ title: 'Cannot unlink', description: json.error?.message || 'Failed to unlink.', variant: 'destructive' });",
         "toast({ title: tt('cannotUnlink'), description: json.error?.message || tt('googleUnlinkFailed'), variant: 'destructive' });"),
        ("toast({ title: 'Error', description: 'Failed to unlink Google.', variant: 'destructive' });",
         "toast({ title: tn('errorTitle'), description: tt('googleUnlinkError'), variant: 'destructive' });"),
        ("title: 'Account scheduled for deletion',\n          description: 'You can cancel any time during the 7-day grace period.',",
         "title: tt('scheduledDeletionTitle'),\n          description: tt('scheduledDeletionDesc'),"),
        ("toast({ title: 'Could not request deletion', description: json.error?.message || 'Please try again.', variant: 'destructive' });",
         "toast({ title: tt('couldNotRequestDeletion'), description: json.error?.message || tt('pleaseTryAgain'), variant: 'destructive' });"),
        ("toast({ title: 'Error', description: 'Failed to request account deletion.', variant: 'destructive' });",
         "toast({ title: tn('errorTitle'), description: tt('deletionRequestFailed'), variant: 'destructive' });"),
        ("toast({ title: 'Deletion cancelled', description: 'Your account will not be deleted.', variant: 'success' });",
         "toast({ title: tt('deletionCancelledTitle'), description: tt('deletionCancelledDesc'), variant: 'success' });"),
        ("toast({ title: 'Error', description: json.error?.message || 'Failed to cancel.', variant: 'destructive' });",
         "toast({ title: tn('errorTitle'), description: json.error?.message || tt('cancelDeletionFailed'), variant: 'destructive' });"),
        ("toast({ title: 'Error', description: 'Failed to cancel deletion.', variant: 'destructive' });",
         "toast({ title: tn('errorTitle'), description: tt('cancelDeletionError'), variant: 'destructive' });"),
        ("toast({ title: 'Image too large', description: 'Please choose an image under 2MB.', variant: 'destructive' });",
         "toast({ title: tt('imageTooLargeTitle'), description: tt('imageTooLargeDesc'), variant: 'destructive' });"),
        ("toast({ title: 'Profile picture updated', variant: 'success' });",
         "toast({ title: tt('profilePictureUpdated'), variant: 'success' });"),
        ("toast({ title: 'Upload failed', description: json.error?.message || 'Could not update profile picture.', variant: 'destructive' });",
         "toast({ title: tt('uploadFailedTitle'), description: json.error?.message || tt('profilePictureUpdateFailed'), variant: 'destructive' });"),
        ("toast({ title: 'Error', description: 'Failed to upload profile picture.', variant: 'destructive' });",
         "toast({ title: tn('errorTitle'), description: tt('profilePictureUploadFailed'), variant: 'destructive' });"),
    ],
)

# address-book
ab_reps = [
    ("toast({ title: 'Verification code sent', description: 'Check your email', variant: 'success' });",
     "toast({ title: tt('verificationCodeSent'), description: tt('checkEmail'), variant: 'success' });"),
    ("description: result.error?.message || 'Failed to send verification code'", "description: result.error?.message || tt('verificationCodeSendFailed')"),
    ("description: 'Failed to send verification code'", "description: tt('verificationCodeSendFailed')"),
    ("title: 'Validation', description: 'Please enter the email verification code'", "title: tn('validationTitle'), description: tt('emailCodeRequired')"),
    ("title: 'Validation', description: 'Please enter the Google 2FA code'", "title: tn('validationTitle'), description: tt('google2faCodeRequired')"),
    ("description: otpResult.error?.message || 'Invalid email verification code'", "description: otpResult.error?.message || tt('invalidEmailVerificationCode')"),
    ("description: faResult.error?.message || 'Invalid 2FA code'", "description: faResult.error?.message || tt('invalid2faCode')"),
    ("description: `Withdrawal Address Whitelist ${newValue ? 'enabled' : 'disabled'} successfully`",
     "description: tt('whitelistUpdated', { status: newValue ? tt('whitelistEnabled') : tt('whitelistDisabled') })"),
    ("description: result.error?.message || 'Failed to update setting'", "description: result.error?.message || tt('settingUpdateFailed')"),
    ("description: 'Failed to update setting'", "description: tt('settingUpdateFailed')"),
    ("title: 'Validation', description: 'Please fill in all required fields'", "title: tn('validationTitle'), description: tt('fillRequiredFields')"),
    ("title: 'Validation', description: 'Please enter recipient account'", "title: tn('validationTitle'), description: tt('recipientAccountRequired')"),
    ("toast({ title: 'Updated', description: 'Address updated successfully.' });", "toast({ title: tt('updatedTitle'), description: tt('addressUpdated') });"),
    ("description: result.error?.message || 'Failed to update address'", "description: result.error?.message || tt('addressUpdateFailed')"),
    ("description: result.error?.message || 'Failed to add address'", "description: result.error?.message || tt('addressAddFailed')"),
    ("description: 'Failed to add address'", "description: tt('addressAddFailed')"),
    ("description: result.error?.message || 'Failed to delete address'", "description: result.error?.message || tt('addressDeleteFailed')"),
    ("description: 'Failed to delete address'", "description: tt('addressDeleteFailed')"),
    ("title: 'Error'", "title: tn('errorTitle')"),
    ("title: 'Success'", "title: tn('successTitle')"),
    ("title: 'Validation'", "title: tn('validationTitle')"),
]
patch(ROOT / "app/dashboard/address-book/page.tsx", "export default function", ab_reps)

batch_reps = [
    ("title: 'Validation', description: 'Please add at least one valid address'", "title: tn('validationTitle'), description: tt('batchAddressRequired')"),
    ("title: 'Success', description: 'All addresses added successfully'", "title: tn('successTitle'), description: tt('batchAddressesAdded')"),
    ("title: 'Partial success', description: 'Some addresses failed to add. Please try again.'", "title: tn('partialSuccessTitle'), description: tt('batchPartialFailed')"),
    ("title: 'Error', description: 'Failed to add addresses'", "title: tn('errorTitle'), description: tt('batchAddFailed')"),
]
patch(ROOT / "app/dashboard/address-book/add-batches/page.tsx", "export default function", batch_reps)

passkeys_reps = [
    ("description: result.error?.message || 'Invalid 2FA code'", "description: result.error?.message || tt('invalid2faCode')"),
    ("toast({ title: 'Error', description: 'Verification failed', variant: 'destructive' });", "toast({ title: tn('errorTitle'), description: tt('verificationFailed'), variant: 'destructive' });"),
    ("toast({ title: 'Passkey added successfully', variant: 'success' });", "toast({ title: tt('passkeyAdded'), variant: 'success' });"),
    ("title: 'Cancelled', description: 'Passkey creation was cancelled or not allowed'", "title: tn('cancelledTitle'), description: tt('passkeyCreationCancelled')"),
    ("title: 'Not supported', description: 'Passkeys are not supported on this device'", "title: tn('notSupportedTitle'), description: tt('passkeysUnsupportedDevice')"),
    ("description: error.message || 'Failed to create passkey'", "description: error.message || tt('passkeyCreateFailed')"),
    ("description: result.error?.message || 'Failed to rename passkey'", "description: result.error?.message || tt('passkeyRenameFailed')"),
    ("description: 'Failed to rename passkey'", "description: tt('passkeyRenameFailed')"),
    ("description: verifyEmailResult.error?.message || 'Invalid email verification code'", "description: verifyEmailResult.error?.message || tt('invalidEmailVerificationCode')"),
    ("description: verify2faResult.error?.message || 'Invalid 2FA code'", "description: verify2faResult.error?.message || tt('invalid2faCode')"),
    ("description: result.error?.message || 'Failed to delete passkey'", "description: result.error?.message || tt('passkeyDeleteFailed')"),
    ("description: 'Failed to delete passkey'", "description: tt('passkeyDeleteFailed')"),
    ("title: 'Error'", "title: tn('errorTitle')"),
]
patch(ROOT / "app/dashboard/security/passkeys/page.tsx", "export default function", passkeys_reps)

wl_reps = [
    ("title: 'Validation', description: `Daily limit must be between 0 and ${limits.maxDailyLimit.toLocaleString()}`",
     "title: tn('validationTitle'), description: tt('dailyLimitRange', { max: limits.maxDailyLimit.toLocaleString() })"),
    ("title: 'Validation', description: `Monthly limit must be between 0 and ${limits.maxMonthlyLimit.toLocaleString()}`",
     "title: tn('validationTitle'), description: tt('monthlyLimitRange', { max: limits.maxMonthlyLimit.toLocaleString() })"),
    ("description: result.error?.message || 'Failed to send verification code'", "description: result.error?.message || tt('verificationCodeSendFailed')"),
    ("description: 'Failed to send verification code'", "description: tt('verificationCodeSendFailed')"),
    ("title: 'Validation', description: 'Please enter the SMS verification code'", "title: tn('validationTitle'), description: tt('smsCodeRequired')"),
    ("title: 'Validation', description: 'Please enter the Google 2FA code'", "title: tn('validationTitle'), description: tt('google2faCodeRequired')"),
    ("description: verifyResult.error?.message || 'Invalid verification code'", "description: verifyResult.error?.message || tt('invalidVerificationCode')"),
    ("description: twoFaResult.error?.message || 'Invalid 2FA code'", "description: twoFaResult.error?.message || tt('invalid2faCode')"),
    ("title: 'Success', description: 'Withdrawal limits updated successfully'", "title: tn('successTitle'), description: tt('limitsUpdatedSuccess')"),
    ("description: result.error?.message || 'Failed to update limits'", "description: result.error?.message || tt('limitsUpdateFailed')"),
    ("description: 'Failed to update withdrawal limits'", "description: tt('limitsUpdateFailedFull')"),
    ("title: 'Error'", "title: tn('errorTitle')"),
]
patch(ROOT / "app/dashboard/security/withdrawal-limits/page.tsx", "export default function", wl_reps)

sessions_reps = [
    ("toast({ title: 'Sessions', description: sessionsRes.error.message, variant: 'destructive' });",
     "toast({ title: tn('sessionsTitle'), description: sessionsRes.error.message, variant: 'destructive' });"),
    ("toast({ title: 'Activity', description: activityRes.error.message, variant: 'destructive' });",
     "toast({ title: tn('activityTitle'), description: activityRes.error.message, variant: 'destructive' });"),
    ("title: 'Sessions ended',\n          description: 'All other devices have been signed out.',",
     "title: tt('sessionsEndedTitle'),\n          description: tt('sessionsEndedDesc'),"),
    ("toast({ title: 'Could not sign out', description: res.error.message, variant: 'destructive' });",
     "toast({ title: tt('couldNotSignOut'), description: res.error.message, variant: 'destructive' });"),
]
patch(ROOT / "app/dashboard/security/sessions/page.tsx", "export default function", sessions_reps)

anti_reps = [
    ("title: 'Invalid code',\n        description: 'Use 4–20 characters (letters, numbers, underscores).',",
     "title: tn('invalidCodeTitle'),\n        description: tt('antiPhishingInvalidDesc'),"),
    ("toast({ title: 'Verification', description: 'Current code does not match.', variant: 'destructive' });",
     "toast({ title: tn('verificationTitle'), description: tt('antiPhishingMismatch'), variant: 'destructive' });"),
    ("toast({ title: 'Saved', description: 'Anti-phishing code updated.', variant: 'success' });",
     "toast({ title: tn('savedTitle'), description: tt('antiPhishingSavedDesc'), variant: 'success' });"),
]
patch(ROOT / "app/dashboard/security/anti-phishing/page.tsx", "export default function", anti_reps)

layout_reps = [
    ("toast({ title: 'Notifications unavailable', description: 'Unable to fetch notifications. Try again.', variant: 'destructive' });",
     "toast({ title: tt('notificationsUnavailableTitle'), description: tt('notificationsUnavailableDesc'), variant: 'destructive' });"),
    ("toast({ title: 'Action failed', description: 'Could not mark notifications as read.', variant: 'destructive' });",
     "toast({ title: tn('errorTitle'), description: tt('markReadFailedDesc'), variant: 'destructive' });"),
    ("toast({ title: 'Copied', description: 'User ID copied to clipboard', variant: 'default' });",
     "toast({ title: tn('copiedTitle'), description: tt('userIdCopiedDesc'), variant: 'default' });"),
]
p = ROOT / "app/dashboard/layout.tsx"
text = p.read_text(encoding="utf-8")
if "useTranslations" not in text:
    text = text.replace("'use client';\n", "'use client';\n\nimport { useTranslations } from 'next-intl';\n")
# layout uses function DashboardLayout - find component
if "const tt = useTranslations" not in text:
    text = text.replace(
        "export default function DashboardLayout",
        "export default function DashboardLayout",
    )
    # insert inside component - find first useState after function
    idx = text.find("export default function DashboardLayout")
    brace = text.find("{", idx)
    insert_at = text.find("\n", brace) + 1
    text = text[:insert_at] + HOOKS + "\n" + text[insert_at:]
for o, n in layout_reps:
    text = text.replace(o, n) if o in text else text
    if o not in text:
        print(f"MISS layout: {o[:50]}")
p.write_text(text, encoding="utf-8")

events_reps = [
    ("toast({ title: 'Sign in required', description: 'Please log in to manage notifications.', variant: 'default' });",
     "toast({ title: tt('signInRequiredTitle'), description: tt('signInForNotifications'), variant: 'default' });"),
    ("toast({ title: 'Not supported', description: \"This browser doesn't support push notifications.\", variant: 'destructive' });",
     "toast({ title: tn('notSupportedTitle'), description: tt('pushNotSupportedDesc'), variant: 'destructive' });"),
    ("toast({ title: 'Notifications blocked', description: 'Allow notifications for this site in your browser settings.', variant: 'destructive' });",
     "toast({ title: tt('notificationsBlockedTitle'), description: tt('notificationsBlockedDesc'), variant: 'destructive' });"),
    ("toast({ title: 'Notifications disabled', variant: 'success' });", "toast({ title: tt('notificationsDisabledTitle'), variant: 'success' });"),
    ("toast({ title: 'Error', description: r.error || 'Failed to disable notifications', variant: 'destructive' });",
     "toast({ title: tn('errorTitle'), description: r.error || tt('settingUpdateFailed'), variant: 'destructive' });"),
    ("toast({ title: 'Notifications enabled', description: \"You'll be notified about new events.\", variant: 'success' });",
     "toast({ title: tt('notificationsEnabledTitle'), description: tt('notificationsEnabledDesc'), variant: 'success' });"),
    ("toast({ title: 'Could not enable', description: r.error || 'Failed to enable notifications', variant: 'destructive' });",
     "toast({ title: tt('couldNotEnableTitle'), description: r.error || tt('settingUpdateFailed'), variant: 'destructive' });"),
]
patch(ROOT / "app/dashboard/events/page.tsx", "export default function", events_reps)

ref_reps = [
    ("title: 'Referral data unavailable'", "title: tt('referralDataUnavailableTitle')"),
    ("toast({ title: 'Copy failed', description: 'Could not copy referral code.', variant: 'destructive' });",
     "toast({ title: tn('errorTitle'), description: tt('copyReferralCodeFailed'), variant: 'destructive' });"),
    ("toast({ title: 'Copy failed', description: 'Could not copy referral link.', variant: 'destructive' };",
     "toast({ title: tn('errorTitle'), description: tt('copyReferralLinkFailed'), variant: 'destructive' };"),
]
# fix typo in ref_reps - remove bad line
ref_reps = [
    ("title: 'Referral data unavailable'", "title: tt('referralDataUnavailableTitle')"),
    ("toast({ title: 'Copy failed', description: 'Could not copy referral code.', variant: 'destructive' });",
     "toast({ title: tn('errorTitle'), description: tt('copyReferralCodeFailed'), variant: 'destructive' });"),
    ("toast({ title: 'Copy failed', description: 'Could not copy referral link.', variant: 'destructive' });",
     "toast({ title: tn('errorTitle'), description: tt('copyReferralLinkFailed'), variant: 'destructive' });"),
    ("toast({ title: 'Link copied to clipboard', variant: 'success' });", "toast({ title: tt('linkCopiedClipboard'), variant: 'success' });"),
]
patch(ROOT / "app/dashboard/referral/page.tsx", "export default function", ref_reps)

myref_reps = [
    ("toast({ title: 'Earnings claimed', description: `Credited to your funding balance: ${summary}`, variant: 'success' });",
     "toast({ title: tt('earningsClaimedTitle'), description: tt('earningsClaimedDesc', { summary }), variant: 'success' });"),
    ("toast({ title: 'Nothing to claim', description: res.error?.message || 'You have no claimable referral earnings.', variant: 'default' });",
     "toast({ title: tt('nothingToClaimTitle'), description: res.error?.message || tt('noClaimableEarnings'), variant: 'default' });"),
    ("toast({ title: 'Error', description: 'Failed to claim referral earnings.', variant: 'destructive' });",
     "toast({ title: tn('errorTitle'), description: tt('claimEarningsFailed'), variant: 'destructive' });"),
]
patch(ROOT / "app/dashboard/referral/my-referrals/page.tsx", "export default function", myref_reps)

api_reps = [
    ("toast({ title: 'IP required', description: 'Add at least one IP address or choose no restriction', variant: 'destructive' });",
     "toast({ title: tt('ipRequiredTitle'), description: tt('ipRequiredDesc'), variant: 'destructive' });"),
    ("toast({ title: 'API key updated', description: 'Your changes have been saved', variant: 'success' });",
     "toast({ title: tt('apiKeyUpdatedTitle'), description: tt('apiKeyUpdatedDesc'), variant: 'success' });"),
    ("description: result.error?.message || 'Failed to update API key'", "description: result.error?.message || tt('apiKeyUpdateFailed')"),
    ("description: 'Failed to update API key'", "description: tt('apiKeyUpdateFailed')"),
    ("toast({ title: 'API key deleted', description: 'Access has been revoked', variant: 'success' });",
     "toast({ title: tt('apiKeyDeletedTitle'), description: tt('apiKeyDeletedDesc'), variant: 'success' });"),
    ("description: result.error?.message || 'Failed to delete API key'", "description: result.error?.message || tt('apiKeyDeleteFailed')"),
    ("description: 'Failed to delete API key'", "description: tt('apiKeyDeleteFailed')"),
    ("title: 'Error'", "title: tn('errorTitle')"),
]
patch(ROOT / "app/dashboard/api/page.tsx", "export default function", api_reps)

print("block2b done")
