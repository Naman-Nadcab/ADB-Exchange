import { Pressable, View, Text } from 'react-native';
import { useTheme, hapticSelection } from '@shared/theme';

type Props = {
  value: 'email' | 'phone';
  onChange: (value: 'email' | 'phone') => void;
  variant?: 'tabs' | 'segment';
};

export function AuthIdTypeToggle({ value, onChange, variant = 'segment' }: Props) {
  const { theme } = useTheme();

  if (variant === 'tabs') {
    return (
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: `hsl(${theme.colors.borderDefault})`, marginBottom: theme.spacing[4] }}>
        {(['email', 'phone'] as const).map((type) => {
          const active = value === type;
          return (
            <Pressable
              key={type}
              onPress={() => {
                void hapticSelection();
                onChange(type);
              }}
              style={{
                flex: 1,
                paddingVertical: theme.spacing[3],
                borderBottomWidth: 2,
                borderBottomColor: active ? `hsl(${theme.colors.foregroundPrimary})` : 'transparent',
              }}
            >
              <Text
                style={[
                  theme.typography.bodyMd,
                  {
                    textAlign: 'center',
                    fontFamily: theme.fonts.sansMedium,
                    color: active ? `hsl(${theme.colors.foregroundPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
                  },
                ]}
              >
                {type === 'email' ? 'Email' : 'Mobile'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 4,
        borderRadius: theme.radius.lg,
        backgroundColor: `hsl(${theme.colors.surfaceAccent})`,
        opacity: 0.85,
        marginBottom: theme.spacing[4],
      }}
    >
      {(['email', 'phone'] as const).map((type) => {
        const active = value === type;
        return (
          <Pressable
            key={type}
            onPress={() => {
              void hapticSelection();
              onChange(type);
            }}
            style={{
              flex: 1,
              paddingVertical: theme.spacing[2],
              borderRadius: theme.radius.md,
              backgroundColor: active ? `hsl(${theme.colors.backgroundElevated})` : 'transparent',
            }}
          >
            <Text
              style={[
                theme.typography.bodyMd,
                {
                  textAlign: 'center',
                  fontFamily: theme.fonts.sansMedium,
                  color: active ? `hsl(${theme.colors.foregroundPrimary})` : `hsl(${theme.colors.foregroundSecondary})`,
                },
              ]}
            >
              {type === 'email' ? 'Email' : 'Mobile'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
