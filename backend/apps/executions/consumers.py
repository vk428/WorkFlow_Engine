"""
WebSocket Consumer for real-time execution updates
"""
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger('apps.executions')


class ExecutionConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer: clients subscribe to execution/{id} channel
    and receive real-time step/status updates.
    """

    async def connect(self):
        self.execution_id = self.scope['url_route']['kwargs']['execution_id']
        self.group_name = f"execution_{self.execution_id}"

        # Join the group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(f"WS connected: {self.group_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"WS disconnected: {self.group_name}")

    async def receive(self, text_data):
        """Handle incoming messages (e.g., ping/pong keepalive)."""
        data = json.loads(text_data)
        if data.get('type') == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    async def execution_update(self, event):
        """Receive message from channel layer and forward to WebSocket client."""
        await self.send(text_data=json.dumps({
            'type': 'execution_update',
            'event': event.get('event'),
            'execution_id': event.get('execution_id'),
            'status': event.get('status'),
            'data': event.get('data', {}),
        }))
