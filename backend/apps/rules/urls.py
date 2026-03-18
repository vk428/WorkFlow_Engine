"""
Rules URLs — rule tester endpoint
"""
from django.urls import path
from .views import RuleTestView

urlpatterns = [
    path('test/', RuleTestView.as_view(), name='rule-test'),
]
