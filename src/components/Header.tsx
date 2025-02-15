// Header.tsx
import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/images/logo.png'
import { AlertBell } from './AlertBell';


interface HeaderProps {
    isLoggedIn: boolean;
    setIsLoggedIn: (value: boolean) => void;
    isAlertOpen: boolean;
    setIsAlertOpen: (value: boolean) => void;
    userInfo: UserInfoType | null;
}

interface UserInfoType {
    data: {
        id: number;
        nickname: string;
        profilePath: string | null;
        role?: string;
    };
}

const Header = ({ isLoggedIn, setIsLoggedIn, isAlertOpen, setIsAlertOpen, userInfo }: HeaderProps) => {
    const location = useLocation();  // 현재 경로 확인을 위한 hook

    // 관리자 페이지에서는 헤더를 렌더링하지 않음
    if (location.pathname.startsWith('/admin')) {
        return null;
    }

    const handleLogout = async () => {
        try {
            const memberId = userInfo?.data?.id;

            const response = await fetch(
                `${import.meta.env.VITE_CORE_API_BASE_URL}/api/v1/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    memberId: memberId
                })
            });

            if (response.ok) {
                setIsLoggedIn(false);
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userInfo');
                window.location.reload();
            } else {
                const errorData = await response.json();
                alert(errorData.msg || '로그아웃에 실패했습니다.');
            }
        } catch (error) {
            console.error('로그아웃 에러:', error);
            alert('서버 연결에 실패했습니다.');
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-30">
            <div className="max-w-[600px] lg:max-w-screen-lg mx-auto h-full px-4 flex justify-between items-center">
                <Link to="/" className="flex items-center">
                    <img src={logo} alt="로고" className="h-8" />
                    <span className="text-primary font-bold ml-2">숨은사람친구</span>
                </Link>
                <div className="flex items-center gap-4">
                    {!isLoggedIn ? (
                        <>
                            <Link
                                to="/login"
                                className="px-4 py-1.5 text-sm font-medium text-primary hover:text-white hover:bg-primary rounded-full transition-all duration-200"
                            >
                                로그인
                            </Link>
                            <Link
                                to="/signup"
                                className="px-4 py-1.5 text-sm font-medium text-primary bg-white hover:text-white hover:bg-red-500 rounded-full transition-all duration-200"
                            >
                                회원가입
                            </Link>
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            <AlertBell isOpen={isAlertOpen} setIsOpen={setIsAlertOpen} />
                            <Link to="/mypage" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={userInfo?.data?.profilePath
                                            ? userInfo.data.profilePath.startsWith('http')
                                                ? userInfo.data.profilePath
                                                : `https://kr.object.ncloudstorage.com/hf-bucket2025/member/${userInfo.data.profilePath}`
                                            : `https://kr.object.ncloudstorage.com/hf-bucket2025/member/default.png`
                                        }
                                        alt="프로필"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span className="text-sm text-gray-600">
                                    {userInfo?.data?.nickname || '사용자'}
                                </span>
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-1.5 text-sm font-medium text-primary hover:text-white hover:bg-red-500 rounded-full transition-all duration-200"
                            >
                                로그아웃
                            </button>
                        </div>
                    )}
                    {userInfo?.data?.role === 'ADMIN' && (
                        <Link
                            to="/admin"
                            className="px-4 py-1.5 text-sm font-medium text-primary hover:text-white hover:bg-primary rounded-full transition-all duration-200"
                        >
                            관리자
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;