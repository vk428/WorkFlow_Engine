"""
Authentication Views
"""
import logging
from rest_framework import generics, status, permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from apps.core.audit import AuditLog
from apps.core.permissions import IsAdmin
from .models import User
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    CustomTokenObtainPairSerializer,
    ChangePasswordSerializer,
)

logger = logging.getLogger('apps.authentication')


class CustomTokenObtainPairView(TokenObtainPairView):
    """Enhanced JWT login — returns tokens + user profile."""
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(email=request.data.get('email'))
            AuditLog.log(
                action=AuditLog.ActionType.LOGIN,
                actor=user,
                description=f'User logged in: {user.email}',
                ip_address=getattr(request, 'audit_ip', '0.0.0.0'),
                user_agent=getattr(request, 'audit_user_agent', 'Unknown'),
            )
        return response


class LogoutView(APIView):
    """Blacklist the refresh token on logout."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            AuditLog.log(
                action=AuditLog.ActionType.LOGOUT,
                actor=request.user,
                description=f'User logged out: {request.user.email}',
            )
            return Response({'success': True, 'message': 'Successfully logged out.'})
        except Exception as e:
            logger.error(f"Logout error: {e}")
            return Response({'success': False, 'error': str(e)}, status=400)


class UserViewSet(viewsets.ModelViewSet):
    """Admin-only user management."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.log(
            action=AuditLog.ActionType.CREATE,
            actor=self.request.user,
            instance=user,
            description=f'User created by admin: {user.email}',
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user_email = instance.email
        if instance == request.user:
            return Response({'error': 'Cannot delete your own account'}, status=status.HTTP_400_BAD_REQUEST)
            
        self.perform_destroy(instance)
        AuditLog.log(
            action=AuditLog.ActionType.DELETE,
            actor=request.user,
            description=f'User deleted by admin: {user_email}',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Get / update current user's profile."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({'success': True, 'data': serializer.data})


class ChangePasswordView(APIView):
    """Allow users to change their own password."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'success': True, 'message': 'Password updated successfully.'})
