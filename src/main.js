import { W, H } from './constants.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';

new Phaser.Game({
  type:            Phaser.AUTO,
  width:           W,
  height:          H,
  backgroundColor: '#000008',
  parent:          'game-container',
  scene:           [MenuScene, GameScene],
});
