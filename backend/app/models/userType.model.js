module.exports = function UserType(sequelize) {
  // var lsgiBlock = require('./lsgiBlock.model')(sequelize);
  var Sequelize = sequelize.constructor;
  var ret =
    sequelize.define('userType', {
   
      name: {
        type: Sequelize.STRING
      },
        display_name: {
            type: Sequelize.STRING
        },
        visibility: {
          type: Sequelize.INTEGER
        },
      status: {
        type: Sequelize.STRING
      },
      created_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },
      modified_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },

    }, {
      tableName: 'user_type',
      timestamps: false

    });
    // ret.relations = {
  //     lsgiBlock: lsgiBlock
  // };
  // ret.hasMany(lsgiBlock, {foreignKey: 'district_id'});
  // lsgiBlock.hasOne(ret, {foreignKey: 'district_id'});
    
  return ret;
}
