import { useSignIn, useSSO } from '@clerk/clerk-expo';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Button from '../components/ui/Button';
import { useTheme } from '../lib/themeContext';
import { RADIUS } from '../lib/tokens';

WebBrowser.maybeCompleteAuthSession();

type Step = 'credentials' | 'second_factor';
type SecondFactorStrategy = 'email_code' | 'totp' | 'backup_code';

// Google brand mark - colors are Google-locked, not theme tokens.
// Same justified-hex category as Button primary's #FFFFFF.
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export default function SignInScreen() {
  const { startSSOFlow } = useSSO();
  const { signIn, setActive: setActiveSession, isLoaded } = useSignIn();
  const { colors } = useTheme();

  const [step, setStep] = useState<Step>('credentials');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [secondFactorStrategy, setSecondFactorStrategy] = useState<SecondFactorStrategy>('totp');
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [hasBackupCode, setHasBackupCode] = useState(false);

  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [error, setError] = useState('');

  const redirectUrl = makeRedirectUri({
    scheme: 'tempbooks',
    path: 'sign-in',
  });

  // Local style helpers - inlined (Path B per migration proposal). Reused 3x in
  // this file. No new Input primitive yet; sign-in is one of only two TextInput
  // sites in the codebase.
  const inputStyle = {
    borderWidth: 0.5,
    borderColor: colors.borderDefault,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: 'Manrope_400Regular' as const,
    color: colors.inkPrimary,
    backgroundColor: colors.surfaceCard,
  };

  const labelStyle = {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold' as const,
    fontWeight: '600' as const,
    color: colors.inkPrimary,
    marginBottom: 6,
  };

  function resetToCredentials() {
    setStep('credentials');
    setCode('');
    setError('');
    setShowStrategyPicker(false);
  }

  async function prepareSecondFactorAndPickStrategy() {
    if (!signIn) return;
    const factors = signIn.supportedSecondFactors ?? [];
    const emailFactor = factors.find((f) => f.strategy === 'email_code');
    const hasTotp = factors.some((f) => f.strategy === 'totp');
    const hasBackup = factors.some((f) => f.strategy === 'backup_code');
    setHasBackupCode(hasBackup);

    // Client Trust (Clerk credential-stuffing defense, on by default since
    // Nov 2025) returns email_code in supportedSecondFactors for new-device
    // sign-ins when MFA is not enrolled. Send the email code immediately so
    // it lands in the inbox before the user reaches the verification screen.
    if (emailFactor && emailFactor.strategy === 'email_code') {
      setSecondFactorStrategy('email_code');
      await signIn.prepareSecondFactor({
        strategy: 'email_code',
        emailAddressId: emailFactor.emailAddressId,
      });
    } else if (hasTotp) {
      setSecondFactorStrategy('totp');
    } else if (hasBackup) {
      setSecondFactorStrategy('backup_code');
    }
  }

  async function handleEmailSignIn() {
    if (!isLoaded || !signIn) return;
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoadingEmail(true);
    try {
      let attempt = await signIn.create({
        strategy: 'password',
        identifier: trimmedEmail,
        password,
      });

      if (attempt.status === 'needs_first_factor') {
        attempt = await signIn.attemptFirstFactor({
          strategy: 'password',
          password,
        });
      }

      if (attempt.status === 'complete' && attempt.createdSessionId && setActiveSession) {
        await setActiveSession({ session: attempt.createdSessionId });
        return;
      }

      if (attempt.status === 'needs_second_factor') {
        await prepareSecondFactorAndPickStrategy();
        setStep('second_factor');
        return;
      }

      setError(`Sign in could not be completed (status: ${attempt.status}). Please try again.`);
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        err?.errors?.[0]?.code ??
        err?.message ??
        'Something went wrong.';
      setError(msg);
    } finally {
      setLoadingEmail(false);
    }
  }

  async function handleVerifySecondFactor() {
    if (!isLoaded || !signIn) return;
    setError('');

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError('Please enter the verification code.');
      return;
    }

    setLoadingMfa(true);
    try {
      const attempt = await signIn.attemptSecondFactor({
        strategy: secondFactorStrategy,
        code: trimmedCode,
      });

      if (attempt.status === 'complete' && attempt.createdSessionId && setActiveSession) {
        await setActiveSession({ session: attempt.createdSessionId });
        return;
      }

      setError(`Verification could not be completed (status: ${attempt.status}). Please try again.`);
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        err?.errors?.[0]?.code ??
        err?.message ??
        'Invalid code. Please try again.';
      setError(msg);
    } finally {
      setLoadingMfa(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoadingGoogle(true);
    setError('');
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      } else {
        setError('Sign in could not be completed. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.message ?? 'Something went wrong.';
      setError(msg);
    } finally {
      setLoadingGoogle(false);
    }
  }

  const anyLoading = loadingEmail || loadingGoogle || loadingMfa;

  // ===== SECOND FACTOR SCREEN =====
  if (step === 'second_factor') {
    const isEmailCode = secondFactorStrategy === 'email_code';
    const isTotp = secondFactorStrategy === 'totp';
    const screenTitle = isEmailCode ? 'Check your email' : 'Two-step verification';
    const codeLabel = isEmailCode ? 'Verification code' : isTotp ? '6-digit code' : 'Backup code';
    const codeHelp = isEmailCode
      ? `We sent a 6-digit code to ${email}. Enter it below to continue.`
      : isTotp
      ? 'Enter the 6-digit code from your authenticator app.'
      : 'Enter one of your saved backup codes.';
    const codePlaceholder = isEmailCode || isTotp ? '123456' : 'XXXX-XXXX';
    const codeKeyboardType: 'number-pad' | 'default' =
      isEmailCode || isTotp ? 'number-pad' : 'default';
    const codeLetterSpacing = isEmailCode || isTotp ? 4 : 1;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: colors.surfaceApp }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: 32, alignItems: 'center' }}>
            <Image
              source={require('../assets/tempo-logo-bar.png')}
              style={{ width: 72, height: 72, borderRadius: 16 }}
              resizeMode="contain"
            />
            <Text style={{
              fontSize: 22,
              lineHeight: 28,
              fontFamily: 'Manrope_700Bold',
              fontWeight: '700',
              color: colors.inkPrimary,
              marginTop: 16,
            }}>
              {screenTitle}
            </Text>
            <Text style={{
              fontSize: 14,
              lineHeight: 20,
              fontFamily: 'Manrope_400Regular',
              color: colors.inkSecondary,
              marginTop: 4,
              textAlign: 'center',
              paddingHorizontal: 16,
            }}>
              {codeHelp}
            </Text>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={labelStyle}>{codeLabel}</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={codePlaceholder}
              placeholderTextColor={colors.inkTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={codeKeyboardType}
              textContentType="oneTimeCode"
              editable={!anyLoading}
              autoFocus
              style={[inputStyle, { letterSpacing: codeLetterSpacing }]}
            />
          </View>

          <Button
            label="Verify"
            onPress={handleVerifySecondFactor}
            variant="primary"
            size="lg"
            fullWidth
            loading={loadingMfa}
            disabled={anyLoading && !loadingMfa}
            style={{ marginBottom: 16 }}
          />

          {hasBackupCode && (
            <TouchableOpacity
              onPress={() => setShowStrategyPicker(!showStrategyPicker)}
              disabled={anyLoading}
              style={{ alignItems: 'center', paddingVertical: 8, marginBottom: 8 }}
              activeOpacity={0.7}
            >
              <Text style={{
                color: colors.brandPrimary,
                fontSize: 14,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
              }}>
                Use a different method
              </Text>
            </TouchableOpacity>
          )}

          {showStrategyPicker && (
            <View style={{ marginBottom: 16, paddingVertical: 8, gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setSecondFactorStrategy('totp');
                  setCode('');
                  setShowStrategyPicker(false);
                }}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderWidth: 0.5,
                  borderColor: secondFactorStrategy === 'totp' ? colors.brandPrimary : colors.borderDefault,
                  borderRadius: RADIUS.md,
                  backgroundColor: colors.surfaceCard,
                }}
              >
                <Text style={{
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkPrimary,
                }}>
                  Authenticator app
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkSecondary,
                  marginTop: 2,
                }}>
                  6-digit code from your app
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSecondFactorStrategy('backup_code');
                  setCode('');
                  setShowStrategyPicker(false);
                }}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderWidth: 0.5,
                  borderColor: secondFactorStrategy === 'backup_code' ? colors.brandPrimary : colors.borderDefault,
                  borderRadius: RADIUS.md,
                  backgroundColor: colors.surfaceCard,
                }}
              >
                <Text style={{
                  fontFamily: 'Manrope_600SemiBold',
                  fontWeight: '600',
                  color: colors.inkPrimary,
                }}>
                  Backup code
                </Text>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Manrope_400Regular',
                  color: colors.inkSecondary,
                  marginTop: 2,
                }}>
                  Use one of your saved recovery codes
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={resetToCredentials}
            disabled={anyLoading}
            style={{ alignItems: 'center', paddingVertical: 12, marginTop: 8 }}
            activeOpacity={0.7}
          >
            <Text style={{
              color: colors.inkSecondary,
              fontSize: 14,
              fontFamily: 'Manrope_400Regular',
            }}>
              Cancel
            </Text>
          </TouchableOpacity>

          {error ? (
            <Text style={{
              color: colors.accentNegative,
              fontSize: 14,
              fontFamily: 'Manrope_400Regular',
              textAlign: 'center',
              marginTop: 16,
            }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ===== CREDENTIALS SCREEN =====
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.surfaceApp }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 32, alignItems: 'center' }}>
          <Image
            source={require('../assets/tempo-logo-bar.png')}
            style={{ width: 72, height: 72, borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text style={{
            fontSize: 22,
            lineHeight: 28,
            fontFamily: 'Manrope_700Bold',
            fontWeight: '700',
            color: colors.inkPrimary,
            marginTop: 16,
          }}>
            Tempo Books
          </Text>
          <Text style={{
            fontSize: 14,
            lineHeight: 20,
            fontFamily: 'Manrope_400Regular',
            color: colors.inkSecondary,
            marginTop: 4,
          }}>
            Sign in to your account
          </Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          <Text style={labelStyle}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!anyLoading}
            style={inputStyle}
          />
        </View>

        <View style={{ marginBottom: 16 }}>
          <Text style={labelStyle}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor={colors.inkTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!anyLoading}
            style={inputStyle}
          />
        </View>

        <Button
          label="Sign in"
          onPress={handleEmailSignIn}
          variant="primary"
          size="lg"
          fullWidth
          loading={loadingEmail}
          disabled={anyLoading && !loadingEmail}
          style={{ marginBottom: 20 }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1, height: 0.5, backgroundColor: colors.borderSubtle }} />
          <Text style={{
            marginHorizontal: 12,
            color: colors.inkSecondary,
            fontSize: 12,
            fontFamily: 'Manrope_400Regular',
          }}>
            or
          </Text>
          <View style={{ flex: 1, height: 0.5, backgroundColor: colors.borderSubtle }} />
        </View>

        <Button
          label="Continue with Google"
          onPress={handleGoogleSignIn}
          variant="secondary"
          size="lg"
          fullWidth
          loading={loadingGoogle}
          disabled={anyLoading && !loadingGoogle}
          leftIcon={<GoogleIcon size={18} />}
        />

        {error ? (
          <Text style={{
            color: colors.accentNegative,
            fontSize: 14,
            fontFamily: 'Manrope_400Regular',
            textAlign: 'center',
            marginTop: 16,
          }}>
            {error}
          </Text>
        ) : null}

        <Text style={{
          textAlign: 'center',
          color: colors.inkTertiary,
          fontSize: 12,
          fontFamily: 'Manrope_400Regular',
          marginTop: 24,
        }}>
          Manage your account at gettempo.ca
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}