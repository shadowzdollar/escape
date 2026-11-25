// Ragdoll physics engine for Fender Bender using cannon-es.
// Creates articulated multi-segment physical bodies with realistic joints,
// hinges, mass distribution and momentum transfer from vehicle and bullet impacts.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const MASS = {
  torso: 26,
  pelvis: 14,
  head: 5,
  upperArmL: 3,
  upperArmR: 3,
  forearmL: 2,
  forearmR: 2,
  thighL: 8,
  thighR: 8,
  shinL: 4,
  shinR: 4,
};

export class RagdollManager {
  constructor(game) {
    this.game = game;
    this.world = new CANNON.World();
    this.world.gravity.set(0, -18, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;

    // Default contact materials
    this.groundMaterial = new CANNON.Material('ground');
    this.ragdollMaterial = new CANNON.Material('ragdoll');
    const contact = new CANNON.ContactMaterial(this.ragdollMaterial, this.groundMaterial, {
      friction: 0.65,
      restitution: 0.1,
    });
    const selfContact = new CANNON.ContactMaterial(this.ragdollMaterial, this.ragdollMaterial, {
      friction: 0.4,
      restitution: 0.05,
    });
    this.world.addContactMaterial(contact);
    this.world.addContactMaterial(selfContact);

    // Ground plane
    const groundBody = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.set(0, 0.15, 0);
    this.world.addBody(groundBody);

    this.activeRagdolls = [];
    this.group = new THREE.Group();
    this.group.name = 'ragdolls';
    game.scene.add(this.group);
  }

  spawn(person, { vx = 0, vy = 2, vz = 0, speed = 10, cause = 'vehicle' } = {}) {
    const x = person.x, y = Math.max(0.2, person.y || 0.15), z = person.z;
    const yaw = person.heading || 0;
    const s = person.s || 1;

    const ragdollRoot = new THREE.Group();
    this.group.add(ragdollRoot);

    const bodies = [];
    const meshes = [];

    const pMat = this.ragdollMaterial;
    const boxGeos = {
      torso: new THREE.BoxGeometry(0.38 * s, 0.45 * s, 0.24 * s),
      head: new THREE.BoxGeometry(0.22 * s, 0.24 * s, 0.22 * s),
      pelvis: new THREE.BoxGeometry(0.34 * s, 0.22 * s, 0.22 * s),
      upperArm: new THREE.BoxGeometry(0.12 * s, 0.28 * s, 0.12 * s),
      forearm: new THREE.BoxGeometry(0.10 * s, 0.26 * s, 0.10 * s),
      thigh: new THREE.BoxGeometry(0.16 * s, 0.38 * s, 0.16 * s),
      shin: new THREE.BoxGeometry(0.14 * s, 0.36 * s, 0.14 * s),
    };

    const clothesColor = person.shirt || new THREE.Color(0x3a6073);
    const pantsColor = person.pants || new THREE.Color(0x202a36);
    const skinColor = person.skin || new THREE.Color(0xd7a57a);

    const matTorso = new THREE.MeshStandardMaterial({ color: clothesColor, roughness: 0.7 });
    const matPants = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7 });
    const matSkin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });

    function createLimb(name, shapeSize, mass, offset, mat, geo) {
      const body = new CANNON.Body({ mass, material: pMat, linearDamping: 0.15, angularDamping: 0.3 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(shapeSize.x / 2, shapeSize.y / 2, shapeSize.z / 2)));
      body.position.set(x + offset.x, y + offset.y, z + offset.z);
      
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      ragdollRoot.add(mesh);

      bodies.push({ name, body });
      meshes.push({ mesh, body });
      return body;
    }

    // 1. Pelvis
    const pelvis = createLimb('pelvis', new THREE.Vector3(0.34 * s, 0.22 * s, 0.22 * s), MASS.pelvis, new THREE.Vector3(0, 0.85 * s, 0), matPants, boxGeos.pelvis);
    // 2. Torso
    const torso = createLimb('torso', new THREE.Vector3(0.38 * s, 0.45 * s, 0.24 * s), MASS.torso, new THREE.Vector3(0, 1.2 * s, 0), matTorso, boxGeos.torso);
    // 3. Head
    const head = createLimb('head', new THREE.Vector3(0.22 * s, 0.24 * s, 0.22 * s), MASS.head, new THREE.Vector3(0, 1.55 * s, 0), matSkin, boxGeos.head);

    // Spine constraint (pelvis to torso)
    const spineConstraint = new CANNON.ConeTwistConstraint(pelvis, torso, {
      pivotA: new CANNON.Vec3(0, 0.15 * s, 0),
      pivotB: new CANNON.Vec3(0, -0.22 * s, 0),
      axisA: new CANNON.Vec3(0, 1, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: 0.35,
      twistAngle: 0.2,
    });
    this.world.addConstraint(spineConstraint);

    // Neck constraint (torso to head)
    const neckConstraint = new CANNON.ConeTwistConstraint(torso, head, {
      pivotA: new CANNON.Vec3(0, 0.24 * s, 0),
      pivotB: new CANNON.Vec3(0, -0.13 * s, 0),
      axisA: new CANNON.Vec3(0, 1, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      angle: 0.4,
      twistAngle: 0.3,
    });
    this.world.addConstraint(neckConstraint);

    // Legs
    for (const side of [-1, 1]) {
      const sign = side < 0 ? 'L' : 'R';
      const ox = side * 0.12 * s;
      const thigh = createLimb('thigh' + sign, new THREE.Vector3(0.16 * s, 0.38 * s, 0.16 * s), MASS.thighL, new THREE.Vector3(ox, 0.58 * s, 0), matPants, boxGeos.thigh);
      const shin = createLimb('shin' + sign, new THREE.Vector3(0.14 * s, 0.36 * s, 0.14 * s), MASS.shinL, new THREE.Vector3(ox, 0.22 * s, 0), matPants, boxGeos.shin);

      // Hip joint
      const hip = new CANNON.ConeTwistConstraint(pelvis, thigh, {
        pivotA: new CANNON.Vec3(ox, -0.11 * s, 0),
        pivotB: new CANNON.Vec3(0, 0.19 * s, 0),
        axisA: new CANNON.Vec3(0, -1, 0),
        axisB: new CANNON.Vec3(0, -1, 0),
        angle: 0.6,
        twistAngle: 0.25,
      });
      this.world.addConstraint(hip);

      // Knee hinge
      const knee = new CANNON.HingeConstraint(thigh, shin, {
        pivotA: new CANNON.Vec3(0, -0.19 * s, 0),
        pivotB: new CANNON.Vec3(0, 0.18 * s, 0),
        axisA: new CANNON.Vec3(1, 0, 0),
        axisB: new CANNON.Vec3(1, 0, 0),
      });
      this.world.addConstraint(knee);
    }

    // Arms
    for (const side of [-1, 1]) {
      const sign = side < 0 ? 'L' : 'R';
      const ox = side * 0.25 * s;
      const upperArm = createLimb('upperArm' + sign, new THREE.Vector3(0.12 * s, 0.28 * s, 0.12 * s), MASS.upperArmL, new THREE.Vector3(ox, 1.25 * s, 0), matTorso, boxGeos.upperArm);
      const forearm = createLimb('forearm' + sign, new THREE.Vector3(0.10 * s, 0.26 * s, 0.10 * s), MASS.forearmL, new THREE.Vector3(ox, 0.96 * s, 0), matSkin, boxGeos.forearm);

      // Shoulder
      const shoulder = new CANNON.ConeTwistConstraint(torso, upperArm, {
        pivotA: new CANNON.Vec3(ox, 0.18 * s, 0),
        pivotB: new CANNON.Vec3(0, 0.14 * s, 0),
        axisA: new CANNON.Vec3(side, 0, 0),
        axisB: new CANNON.Vec3(side, 0, 0),
        angle: 0.8,
        twistAngle: 0.4,
      });
      this.world.addConstraint(shoulder);

      // Elbow hinge
      const elbow = new CANNON.HingeConstraint(upperArm, forearm, {
        pivotA: new CANNON.Vec3(0, -0.14 * s, 0),
        pivotB: new CANNON.Vec3(0, 0.13 * s, 0),
        axisA: new CANNON.Vec3(1, 0, 0),
        axisB: new CANNON.Vec3(1, 0, 0),
      });
      this.world.addConstraint(elbow);
    }

    // Apply impulse / velocity to all bodies
    for (const { body } of bodies) {
      this.world.addBody(body);
      body.velocity.set(
        vx + (Math.random() - 0.5) * 2,
        vy + (Math.random() - 0.2) * 1.5,
        vz + (Math.random() - 0.5) * 2
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 6
      );
    }

    const ragdoll = {
      root: ragdollRoot,
      bodies,
      meshes,
      life: 8.0, // seconds until fade
      person,
    };
    this.activeRagdolls.push(ragdoll);

    // Limit active ragdolls for performance
    if (this.activeRagdolls.length > 12) {
      this.remove(this.activeRagdolls.shift());
    }

    return ragdoll;
  }

  remove(ragdoll) {
    if (!ragdoll) return;
    for (const { body } of ragdoll.bodies) {
      this.world.removeBody(body);
    }
    this.group.remove(ragdoll.root);
  }

  update(dt) {
    if (this.activeRagdolls.length === 0) return;

    // Step physics world with sub-steps
    const step = Math.min(dt, 0.05);
    this.world.step(1 / 60, step, 3);

    // Sync visual meshes to cannon bodies
    for (let i = this.activeRagdolls.length - 1; i >= 0; i--) {
      const rd = this.activeRagdolls[i];
      rd.life -= dt;

      for (const { mesh, body } of rd.meshes) {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
      }

      // Fade out at end of life
      if (rd.life < 1.0) {
        rd.root.scale.setScalar(Math.max(0.01, rd.life));
      }

      if (rd.life <= 0) {
        this.remove(rd);
        this.activeRagdolls.splice(i, 1);
      }
    }
  }

  reset() {
    while (this.activeRagdolls.length > 0) {
      this.remove(this.activeRagdolls.pop());
    }
  }
}
