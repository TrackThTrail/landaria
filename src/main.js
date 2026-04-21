import { W, H } from './constants.js';
import { GameScene } from './scenes/GameScene.js';

new Phaser.Game({
  type:            Phaser.AUTO,
  width:           W,
  height:          H,
  backgroundColor: '#0d0d1a',
  parent:          'game-container',
  scene:           GameScene,
});
