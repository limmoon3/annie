        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        darkBg: '#f8fafc',
                        cardBg: '#ffffff',
                        cardBorder: '#e2e8f0',
                        primary: '#4f46e5',
                        primaryHover: '#4338ca',
                        accent: '#f59e0b',
                        textMain: '#0f172a',
                        textMuted: '#64748b'
                    },
                    fontFamily: {
                        sans: ['Pretendard', 'Malgun Gothic', 'sans-serif'],
                    },
                    animation: {
                        'fade-in': 'fadeIn 0.4s ease-out forwards',
                        'slide-up': 'slideUp 0.5s ease-out forwards',
                    },
                    keyframes: {
                        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
                        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }
                    }
                }
            }
        }
    
