module.exports = function Image(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('image', {
        name: {
          type: Sequelize.STRING
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
        }
  
      }, {
        tableName: 'image',
        timestamps: false
  
      });
  
    return ret;
  }