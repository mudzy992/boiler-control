import React from 'react';
import { Box, VStack, HStack, Text, useColorModeValue } from 'native-base';
import { Ionicons } from '@expo/vector-icons';
import type { TodayWeather } from '../types/Weather';

interface WeatherCardProps {
  weather: TodayWeather;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ weather }) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.100');
  const mutedColor = useColorModeValue('gray.600', 'gray.400');
  const accentColor = useColorModeValue('brand.500', 'brand.400');

  // Map weather condition to icon
  const getWeatherIcon = (condition?: string) => {
    if (!condition) return 'partly-sunny';
    const lower = condition.toLowerCase();
    if (lower.includes('rain')) return 'rainy';
    if (lower.includes('cloud')) return 'cloudy';
    if (lower.includes('sunny') || lower.includes('clear')) return 'sunny';
    if (lower.includes('snow')) return 'snow';
    if (lower.includes('wind')) return 'flash';
    return 'partly-sunny';
  };

  return (
    <Box
      bg={bgColor}
      borderWidth={1}
      borderColor={borderColor}
      rounded="xl"
      p={5}
      shadow={2}
      _dark={{ shadow: 'none', borderColor: 'gray.700' }}
    >
      <VStack space={4}>
        {/* Main weather info */}
        <HStack justifyContent="space-between" alignItems="center">
          <VStack space={1.5} flex={1}>
            <Text
              fontSize="xs"
              fontWeight="700"
              color={mutedColor}
              textTransform="uppercase"
              letterSpacing="0.5"
            >
              Current Weather
            </Text>
            <HStack alignItems="baseline" space={1}>
              <Text fontSize="5xl" fontWeight="800" color={textColor}>
                {weather?.temp ? weather.temp.toFixed(0) : '—'}
              </Text>
              <Text fontSize="2xl" fontWeight="600" color={mutedColor}>
                °C
              </Text>
            </HStack>
            <Text fontSize="sm" fontWeight="500" color={mutedColor}>
              Feels like {weather?.feelsLike ? weather.feelsLike.toFixed(0) : '—'}°C
            </Text>
            <Text fontSize="md" fontWeight="700" color={accentColor} mt={1}>
              {weather.condition}
            </Text>
          </VStack>

          <Box bg={accentColor} rounded="full" p={3}>
            <Ionicons name={getWeatherIcon(weather.condition)} size={64} color="white" />
          </Box>
        </HStack>

        {/* Weather details grid */}
        <HStack space={3} justifyContent="space-between">
          {/* Humidity */}
          <Box
            flex={1}
            bg={useColorModeValue('gray.100', 'gray.700')}
            rounded="xl"
            p={3}
            alignItems="center"
          >
            <Ionicons name="water" size={24} color={accentColor} />
            <Text fontSize="lg" fontWeight="700" color={textColor} mt={2}>
              {weather?.humidity ?? '—'}%
            </Text>
            <Text fontSize="xs" fontWeight="600" color={mutedColor} mt={0.5}>
              Humidity
            </Text>
          </Box>

          {/* Wind */}
          <Box
            flex={1}
            bg={useColorModeValue('gray.100', 'gray.700')}
            rounded="xl"
            p={3}
            alignItems="center"
          >
            <Ionicons name="cloudy-outline" size={24} color={accentColor} />
            <Text fontSize="lg" fontWeight="700" color={textColor} mt={2}>
              {weather?.windSpeed ? weather.windSpeed.toFixed(1) : '—'}
            </Text>
            <Text fontSize="xs" fontWeight="600" color={mutedColor} mt={0.5}>
              m/s
            </Text>
          </Box>

          {/* Pressure */}
          <Box
            flex={1}
            bg={useColorModeValue('gray.100', 'gray.700')}
            rounded="xl"
            p={3}
            alignItems="center"
          >
            <Ionicons name="git-branch" size={24} color={accentColor} />
            <Text fontSize="lg" fontWeight="700" color={textColor} mt={2}>
              {weather?.pressure ?? '—'}
            </Text>
            <Text fontSize="xs" fontWeight="600" color={mutedColor} mt={0.5}>
              hPa
            </Text>
          </Box>
        </HStack>
      </VStack>
    </Box>
  );
};
